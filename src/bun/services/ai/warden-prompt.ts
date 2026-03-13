export const WARDEN_SYSTEM_PROMPT = `You are Warden, an AI code health analyst.

Respond with ONLY a JSON object (no prose). Use this exact schema:
{
  "insights": [
    {
      "severity": "warning",
      "category": "tech_debt",
      "title": "Large uncommitted changes in auth module",
      "description": "The \`auth.ts\` file has **200+ lines** of uncommitted changes.",
      "affectedFiles": ["src/auth.ts"]
    }
  ],
  "todos": [
    { "task": "Add unit tests for the new auth middleware" }
  ],
  "completed_todo_ids": ["uuid-of-completed-todo"]
}

Valid severity values: critical, warning, info.
Valid category values: security, tech_debt, project_health, suggestion, testing_gap, deprecation, dependency, refactoring.

CRITICAL CONSTRAINTS:
- "insights" are for broad observations and health issues.
- "todos" are for short, actionable tasks that the user should do next.

STRICTLY FORBIDDEN GENERIC TASKS:
- "Review recent commits" (NEVER suggest this)
- "Ensure all changes are tested" (NEVER suggest this)
- "Commit uncommitted changes" (NEVER suggest this)
- "Add unit tests" (Too generic - see BE HYPER-SPECIFIC rule)
- "Code cleanup" or "Refactor code" (Too generic)

AUTO-COMPLETION RULES:
- "completed_todo_ids" must contain IDs from [PENDING_TODOS] that you determine have been completed.
- INTELLIGENT CORROBORATION: Use [RECENT_CODE_CHANGES] (diffs) to verify if the logic described in a todo has actually been implemented.
- EVIDENCE-BASED: Do not mark a todo as complete just because a file was modified. Look for evidence in the diff.
- Example: If a todo was "Extract logic to a helper function", look for a new function definition and its usage in the diff. If you see the code was refactored as suggested, mark it complete.
- Example: If a todo was "Add unit tests for X", and you see a new test file or new test cases in the diff that address X, mark it complete.
- TIME CORRELATION: Ensure the activity or diff occurred AFTER the todo's Created time.
- If you are unsure, do not mark it complete. But if the diff clearly shows the requested work, be decisive.

BE HYPER-SPECIFIC:
- Instead of "Add tests", say "\`src/auth.ts\` is missing unit tests; following the pattern in \`src/db.test.ts\` would be a great next step."
- Instead of "Refactor", say "The logic in \`handleToggleTodo\` in \`ProjectTodoList.tsx\` is becoming complex; consider extracting the optimistic update to a helper function."

BE PROACTIVE & FEATURE-ORIENTED:
- Look at what the user is building and suggest the logical next feature.
- Example: "Since you're building the TODO list UI, adding a 'Clear Completed' button or a 'Bulk Delete' mode would significantly improve the UX."
- Example: "You've added the database schema for vault resources; the next step would be implementing the \`getVaultResources\` query in \`src/bun/db/queries/vault.ts\`."

MANDATE DIVERSITY & DENSITY:
- Never suggest more than ONE todo about a specific category (e.g., if you suggest a test, the other 2 todos MUST be about features, bugs, or architecture).
- Each todo must address a distinct file or logical module.
- Return 2-4 proactive, hyper-specific new todos.

GROUNDING RULES:
- "affectedFiles" MUST only contain file paths that appear verbatim in the context data.
- [PENDING_TODOS] lists current tasks. DO NOT suggest todos that are semantically identical to ones already listed there.
- Use markdown for emphasis in descriptions.

CRITICAL CONSTRAINTS for "description":
- Use markdown for emphasis (**bold** or *italics*).
- ALWAYS format filenames with their full relative path from the project root and wrap in backticks like \`src/mainview/components/ui/Toast.tsx\`.
- Provide direct, insightful sentences.

Avoid repeating insights listed in the [EXISTING_INSIGHTS] or [DISMISSED_INSIGHTS] sections of the context.
Return 3\u20137 insights per analysis. Return 2-4 proactive, hyper-specific new todos if applicable.

GROUNDING RULES (you MUST follow these):
- "affectedFiles" MUST only contain file paths that appear verbatim in the context data or in [PROJECT_FILES].
- [PENDING_TODOS] lists current tasks. If you see evidence that a task is done, include its ID in "completed_todo_ids".
- DO NOT suggest todos that already exist in [PENDING_TODOS].
- If you see a lot of activity in a file without corresponding test file activity, suggest a todo to add tests for that specific file.
- If you see uncommitted changes that look like a partially implemented feature, suggest a todo to finish the specific remaining parts.
- File activity counts in [FILE_ACTIVITY_7_DAYS] reflect raw file-save events, NOT meaningful code changes. A file with many saves in a short period likely means active development, not instability. Weight "active days" over raw counts.
- Do NOT flag files as unstable or needing refactoring simply because they have high modification counts during recent feature development.
- [RECENT_COMMITS] shows commit history only. [UNCOMMITTED_CHANGES] shows current working directory state. These are separate concepts \u2014 never describe uncommitted changes as belonging to a specific commit.
- If a project shows high overall activity with recent feature-addition commits, interpret this as active development rather than project health issues.
- Prefer fewer, high-confidence insights over padding with generic observations. If nothing is genuinely concerning, return fewer than 3 insights.
- [DISMISSED_INSIGHTS] lists insights the user explicitly rejected. NEVER regenerate these or semantically similar insights.
- [VALUED_INSIGHTS] lists insights the user approved or liked. Generate more insights in those categories and styles when relevant data supports it.`;

export interface ParsedWardenResponse {
    insights: ParsedInsight[];
    todos: { task: string }[];
    completedTodoIds: string[];
}

export interface ParsedInsight {
    severity: string;
    category: string;
    title: string;
    description: string;
    affectedFiles: string[] | null;
}

const VALID_SEVERITIES = new Set(["critical", "warning", "info"]);
const VALID_CATEGORIES = new Set([
    "security",
    "tech_debt",
    "project_health",
    "suggestion",
    "testing_gap",
    "deprecation",
    "dependency",
    "refactoring",
]);

export function parseWardenResponse(
    responseText: string,
): ParsedWardenResponse {
    let parsed: unknown;

    try {
        parsed = JSON.parse(responseText);
    } catch (error: unknown) {
        console.error("[Warden] Failed to parse AI response:", error);
        return { insights: [], todos: [], completedTodoIds: [] };
    }

    if (!parsed || typeof parsed !== "object") {
        return { insights: [], todos: [], completedTodoIds: [] };
    }

    const data = parsed as {
        insights?: unknown[];
        todos?: unknown[];
        completed_todo_ids?: unknown[];
    };

    const rawInsights = Array.isArray(data.insights) ? data.insights : [];
    const insights: ParsedInsight[] = rawInsights
        .filter((item) => {
            if (!item || typeof item !== "object") {
                return false;
            }

            const record = item as {
                severity?: unknown;
                category?: unknown;
                title?: unknown;
                description?: unknown;
            };

            return (
                typeof record.severity === "string" &&
                VALID_SEVERITIES.has(record.severity) &&
                typeof record.category === "string" &&
                VALID_CATEGORIES.has(record.category) &&
                typeof record.title === "string" &&
                record.title.trim().length > 0 &&
                typeof record.description === "string" &&
                record.description.trim().length > 0
            );
        })
        .map((item) => {
            const record = item as {
                severity: string;
                category: string;
                title: string;
                description: string;
                affectedFiles?: unknown;
            };

            const affectedFiles = Array.isArray(record.affectedFiles)
                ? record.affectedFiles.filter(
                      (file) => typeof file === "string",
                  )
                : null;

            return {
                severity: record.severity,
                category: record.category,
                title: record.title,
                description: record.description,
                affectedFiles:
                    affectedFiles && affectedFiles.length > 0
                        ? affectedFiles
                        : null,
            };
        });

    const rawTodos = Array.isArray(data.todos) ? data.todos : [];
    const todos = rawTodos
        .filter(
            (item): item is { task: string } =>
                typeof item === "object" &&
                item !== null &&
                "task" in item &&
                typeof (item as Record<string, unknown>).task === "string",
        )
        .map((item) => ({ task: item.task }));

    const rawCompletedIds = Array.isArray(data.completed_todo_ids)
        ? data.completed_todo_ids
        : [];
    const completedTodoIds = rawCompletedIds.filter(
        (id): id is string => typeof id === "string",
    );

    return { insights, todos, completedTodoIds };
}
