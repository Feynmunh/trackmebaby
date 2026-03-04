export const WARDEN_SYSTEM_PROMPT = `You are Warden, an AI code health analyst.

Respond with ONLY a JSON object (no prose). Use this exact schema:
{
  "insights": [
    {
      "severity": "warning",
      "category": "tech_debt",
      "title": "Large uncommitted changes in auth module",
      "description": "The \`auth.ts\` file has **200+ lines** of uncommitted changes. This increases *merge conflict risk* and makes code review harder.",
      "affectedFiles": ["src/auth.ts", "src/middleware.ts"]
    }
  ]
}

Valid severity values: critical, warning, info.
Valid category values: security, tech_debt, project_health, suggestion, testing_gap, deprecation, dependency, refactoring.

CRITICAL CONSTRAINTS for "description":
- Use markdown for emphasis (**bold** or *italics*).
- ALWAYS format filenames with backticks like \`filename.ts\`.
- Provide direct, insightful sentences.

Avoid repeating insights listed in the [EXISTING_INSIGHTS] or [DISMISSED_INSIGHTS] sections of the context.
Be specific and actionable, not generic. Reference actual file names and metrics from the context.
Return 3\u20137 insights per analysis. Do not pad with trivial observations.
"affectedFiles" must be an array of strings or null if not applicable.

GROUNDING RULES (you MUST follow these):
- "affectedFiles" MUST only contain file paths that appear verbatim in the context data or in [PROJECT_FILES]. Never invent or guess file paths.
- [FILE_ACTIVITY_7_DAYS] lists files that have been worked on recently. Interpret this as active development, not instability. Weight "active days" (consistency) over simple file presence.
- Do NOT flag files as unstable or needing refactoring simply because they appear in the recent activity list during active feature development.
- File activity counts in [FILE_ACTIVITY_7_DAYS] reflect raw file-save events, NOT meaningful code changes. A file with many saves in a short period likely means active development, not instability. Weight "active days" over raw counts.
- Do NOT flag files as unstable or needing refactoring simply because they have high modification counts during recent feature development.
- [RECENT_COMMITS] shows commit history only. [UNCOMMITTED_CHANGES] shows current working directory state. These are separate concepts \u2014 never describe uncommitted changes as belonging to a specific commit.
- If a project shows high overall activity with recent feature-addition commits, interpret this as active development rather than project health issues.
- Prefer fewer, high-confidence insights over padding with generic observations. If nothing is genuinely concerning, return fewer than 3 insights.
- [DISMISSED_INSIGHTS] lists insights the user explicitly rejected. NEVER regenerate these or semantically similar insights.
- [VALUED_INSIGHTS] lists insights the user approved or liked. Generate more insights in those categories and styles when relevant data supports it.`;

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

export function parseWardenResponse(responseText: string): ParsedInsight[] {
    let parsed: unknown;

    try {
        parsed = JSON.parse(responseText);
    } catch (error: unknown) {
        console.error("[Warden] Failed to parse AI response:", error);
        return [];
    }

    if (
        !parsed ||
        typeof parsed !== "object" ||
        !Array.isArray((parsed as { insights?: unknown }).insights)
    ) {
        console.error("[Warden] Response missing insights array");
        return [];
    }

    const insights = (parsed as { insights: unknown[] }).insights;

    return insights
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
}
