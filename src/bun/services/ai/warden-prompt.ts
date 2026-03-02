export const WARDEN_SYSTEM_PROMPT = `You are Warden, an AI code health analyst.

Respond with ONLY a JSON object (no prose, no markdown). Use this exact schema:
{
  "insights": [
    {
      "severity": "warning",
      "category": "tech_debt",
      "title": "Large uncommitted changes in auth module",
      "description": "auth.ts has 200+ lines of uncommitted changes. This increases merge conflict risk and makes code review harder.",
      "affectedFiles": ["src/auth.ts", "src/middleware.ts"]
    }
  ]
}

Valid severity values: critical, warning, info.
Valid category values: security, tech_debt, project_health, suggestion, testing_gap, deprecation, dependency, refactoring.

Avoid repeating insights listed in the [EXISTING_INSIGHTS] section of the context.
Be specific and actionable, not generic. Reference actual file names and metrics from the context.
Return 3–7 insights per analysis. Do not pad with trivial observations.
"affectedFiles" must be an array of strings or null if not applicable.`;

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
