import type { Database } from "bun:sqlite";
import { toErrorData, toErrorMessage } from "../../../../shared/error.ts";
import { createLogger } from "../../../../shared/logger.ts";
import type {
    AIQueryOptions,
    ScreenContext,
} from "../../../../shared/types.ts";
import {
    createConversation,
    deleteConversation,
    getConversationMessages,
    getConversations,
    getRecentConversationMessages,
    insertChatMessage,
    updateConversationTitle,
} from "../../../db/queries.ts";
import { assembleContext } from "../../../services/ai/context-assembler.ts";
import { type AIProvider } from "../../../services/ai/index.ts";
import type { ChatTurn } from "../../../services/ai/provider.ts";

export interface AIHandlersDeps {
    db: Database;
    getAIProvider: () => AIProvider;
}

const logger = createLogger("rpc");

const CHAT_SYSTEM_PROMPT = `You are trackmebaby AI, a developer assistant embedded in a desktop app that tracks coding activity across projects. You help developers understand their work, answer questions about their projects, and provide insights.

CAPABILITIES:
- You can see the user's tracked projects, file changes, git activity, and project metadata.
- When the user tags a project with @, you receive detailed context about that project.
- You may receive context about what the user is currently viewing on screen.

GUIDELINES:
- Be concise, helpful, and developer-focused.
- Use markdown formatting: **bold**, *italics*, \`code\`, and code blocks with language tags.
- When discussing files, wrap names in backticks like \`filename.ts\`.
- If you have no data about something, say so clearly rather than guessing.
- Be conversational but efficient — developers value speed.`;

const PROJECT_SUMMARY_SYSTEM_PROMPT = `You are trackmebaby, an insightful senior developer. Summarize the LATEST work based on the provided activity and diff context.

CRITICAL CONSTRAINTS:
- Start immediately. NO introductory phrases like "In this project", "You have been", or "The activity shows".
- DO NOT mention the project name, branch name, or line/file counts. The user already sees these.
- Focus on the logical features, refactors, or bugs addressed.
- Use markdown for emphasis (**bold** or *italics*).
- ALWAYS format filenames with backticks like \`filename.ts\`.
- Provide 3-4 sentences as one coherent paragraph (no bullets).

Example of GOOD response: "Refining the \`auth.ts\` middleware to handle JWT expiry more gracefully. The **session refresh** logic now covers edge cases that previously caused silent failures. Error reporting is clearer, and the related *middleware wiring* has been simplified for better readability." 

Example of BAD response: "In the trackmebaby project, you modified 3 files on the master branch to add auth."`;

const FILE_SUMMARY_SYSTEM_PROMPT = `You are a code review expert. Summarize the logical intent of the code changes using the provided file context and diff.

CRITICAL CONSTRAINTS:
- Start immediately. NO introductory phrases like "This file", "The changes", or "This modification".
- DO NOT mention the file name or line metrics (additions/deletions). The user already sees these.
- Summarize WHAT the code change DOES logically and WHY.
- Keep it to 1-2 direct, insightful sentences.

Example of GOOD response: "Migrating the database connector to use a connection pool for better performance."
Example of BAD response: "Modified db.ts with 50 additions to add connection pooling."`;

export function createAIHandlers({ db, getAIProvider }: AIHandlersDeps) {
    return {
        queryAI: async ({
            question,
            options,
        }: {
            question: string;
            options?: AIQueryOptions;
        }) => {
            try {
                const task = options?.task ?? "general";
                const context = await assembleContext(db, question, options);
                const provider = getAIProvider();
                const systemPrompt =
                    task === "file_summary"
                        ? FILE_SUMMARY_SYSTEM_PROMPT
                        : task === "project_summary"
                          ? PROJECT_SUMMARY_SYSTEM_PROMPT
                          : undefined;
                return await provider.query(context, question, systemPrompt);
            } catch (err: unknown) {
                const message = toErrorMessage(err);
                logger.error("ai query error", {
                    error: toErrorData(err),
                });
                return `Error: ${message}`;
            }
        },

        // --- Conversation Management ---

        createConversation: ({ title }: { title?: string }) => {
            const id = crypto.randomUUID();
            return createConversation(db, id, title);
        },

        getConversations: () => {
            return getConversations(db);
        },

        getConversationMessages: ({
            conversationId,
        }: {
            conversationId: string;
        }) => {
            return getConversationMessages(db, conversationId);
        },

        deleteConversation: ({
            conversationId,
        }: {
            conversationId: string;
        }) => {
            deleteConversation(db, conversationId);
            return { success: true };
        },

        renameConversation: ({
            conversationId,
            title,
        }: {
            conversationId: string;
            title: string;
        }) => {
            updateConversationTitle(db, conversationId, title);
            return { success: true };
        },

        sendChatMessage: async ({
            conversationId,
            content,
            taggedProjectIds,
            screenContext,
        }: {
            conversationId: string;
            content: string;
            taggedProjectIds?: string[];
            screenContext?: ScreenContext;
        }) => {
            // 1. Save user message
            const userMsg = insertChatMessage(db, {
                id: crypto.randomUUID(),
                conversationId,
                role: "user",
                content,
                taggedProjectIds,
                screenContext,
            });

            try {
                // 2. Build context from tagged projects + screen context
                const contextParts: string[] = [];

                if (taggedProjectIds && taggedProjectIds.length > 0) {
                    for (const projectId of taggedProjectIds) {
                        const projectContext = await assembleContext(
                            db,
                            content,
                            { projectId },
                        );
                        contextParts.push(projectContext);
                    }
                }

                if (screenContext) {
                    contextParts.push(
                        `[SCREEN_CONTEXT]\nThe user is currently viewing: Tab="${screenContext.activeTab}"` +
                            (screenContext.selectedProjectName
                                ? `, Project="${screenContext.selectedProjectName}"`
                                : "") +
                            (screenContext.visibleData
                                ? `\nVisible data: ${screenContext.visibleData}`
                                : ""),
                    );
                }

                // If no tagged projects, add general context
                if (
                    (!taggedProjectIds || taggedProjectIds.length === 0) &&
                    !screenContext
                ) {
                    const generalContext = await assembleContext(db, content);
                    contextParts.push(generalContext);
                }

                // 3. Build multi-turn messages
                const history = getRecentConversationMessages(
                    db,
                    conversationId,
                    20,
                );
                // Exclude the just-inserted user msg from history (it's already there)
                const pastMessages = history.filter((m) => m.id !== userMsg.id);

                const systemPrompt =
                    CHAT_SYSTEM_PROMPT +
                    (contextParts.length > 0
                        ? `\n\n--- Developer Context ---\n${contextParts.join("\n\n")}`
                        : "");

                const turns: ChatTurn[] = [
                    ...pastMessages.map((m) => ({
                        role: m.role as "user" | "assistant",
                        content: m.content,
                    })),
                    { role: "user" as const, content },
                ];

                // 4. Query AI
                const provider = getAIProvider();
                const response = await provider.queryMultiTurn(
                    systemPrompt,
                    turns,
                    { maxTokens: 2048 },
                );

                // 5. Save assistant message
                const assistantMsg = insertChatMessage(db, {
                    id: crypto.randomUUID(),
                    conversationId,
                    role: "assistant",
                    content: response,
                });

                // 6. Auto-title after first exchange
                if (pastMessages.length === 0) {
                    try {
                        const titleResponse = await provider.queryMultiTurn(
                            "Generate a short title (3-6 words, no quotes) for this conversation based on the user's first message. Reply with ONLY the title, nothing else.",
                            [{ role: "user", content }],
                            { maxTokens: 30 },
                        );
                        const title = titleResponse
                            .replace(/^["']|["']$/g, "")
                            .trim()
                            .slice(0, 80);
                        if (title) {
                            updateConversationTitle(db, conversationId, title);
                        }
                    } catch {
                        // Title generation is best-effort
                    }
                }

                return { userMessage: userMsg, assistantMessage: assistantMsg };
            } catch (err: unknown) {
                const message = toErrorMessage(err);
                logger.error("chat message error", {
                    error: toErrorData(err),
                });
                // Save error as assistant message
                const errMsg = insertChatMessage(db, {
                    id: crypto.randomUUID(),
                    conversationId,
                    role: "assistant",
                    content: `Error: ${message}`,
                });
                return { userMessage: userMsg, assistantMessage: errMsg };
            }
        },

        getScreenContext: async ({
            activeTab,
            selectedProjectId,
        }: {
            activeTab: string;
            selectedProjectId?: string;
        }) => {
            const parts: string[] = [];
            parts.push(`Active tab: ${activeTab}`);

            if (selectedProjectId) {
                const context = await assembleContext(
                    db,
                    "describe current state",
                    {
                        projectId: selectedProjectId,
                    },
                );
                parts.push(context);
            }

            return parts.join("\n");
        },
    };
}
