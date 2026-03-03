import type { Database } from "bun:sqlite";
import { toErrorData, toErrorMessage } from "../../../../shared/error.ts";
import { createLogger } from "../../../../shared/logger.ts";
import type { AIQueryOptions } from "../../../../shared/types.ts";
import { assembleContext } from "../../../services/ai/context-assembler.ts";
import { type AIProvider } from "../../../services/ai/index.ts";

export interface AIHandlersDeps {
    db: Database;
    getAIProvider: () => AIProvider;
}

const logger = createLogger("rpc");
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
    };
}
