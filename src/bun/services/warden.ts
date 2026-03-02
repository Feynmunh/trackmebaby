import type { Database } from "bun:sqlite";
import type {
    GitSnapshot,
    WardenCategory,
    WardenInsight,
    WardenSeverity,
} from "../../shared/types.ts";
import {
    getProjectByPath,
    getSetting,
    insertWardenInsight,
} from "../db/queries.ts";
import { assembleWardenContext } from "./ai/warden-context.ts";
import {
    parseWardenResponse,
    WARDEN_SYSTEM_PROMPT,
} from "./ai/warden-prompt.ts";

type InsightsCallback = (projectId: string, insights: WardenInsight[]) => void;

export class WardenService {
    private db: Database;
    private lastRunAt: Map<string, number> = new Map();
    private isRunning: Map<string, boolean> = new Map();
    private lastCommitHash: Map<string, string> = new Map();
    private onInsightsGenerated?: InsightsCallback;
    private readonly COOLDOWN_MS = 5 * 60 * 1000;

    constructor(db: Database, onInsightsGenerated?: InsightsCallback) {
        this.db = db;
        this.onInsightsGenerated = onInsightsGenerated;
    }

    async analyzeProject(
        projectId: string,
        projectPath: string,
        isManual: boolean = false,
    ): Promise<WardenInsight[]> {
        void projectPath;
        const apiKey = getSetting(this.db, "aiApiKey");
        if (!apiKey) {
            console.log("[Warden] No API key configured, skipping analysis");
            return [];
        }

        const lastRun = this.lastRunAt.get(projectId) ?? 0;
        if (!isManual && Date.now() - lastRun < this.COOLDOWN_MS) {
            return [];
        }

        if (this.isRunning.get(projectId) === true) {
            return [];
        }

        this.isRunning.set(projectId, true);

        try {
            const context = await assembleWardenContext(this.db, projectId);
            const response = await fetch(
                "https://api.groq.com/openai/v1/chat/completions",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        model: "llama-3.3-70b-versatile",
                        messages: [
                            { role: "system", content: WARDEN_SYSTEM_PROMPT },
                            { role: "user", content: context },
                        ],
                        temperature: 0.3,
                        max_tokens: 2048,
                        response_format: { type: "json_object" },
                    }),
                },
            );
            const data = await response.json();
            const aiText = data.choices?.[0]?.message?.content ?? "";
            const parsedInsights = parseWardenResponse(aiText);
            const inserted: WardenInsight[] = [];

            for (const parsedInsight of parsedInsights) {
                const insight = insertWardenInsight(
                    this.db,
                    projectId,
                    parsedInsight.severity as WardenSeverity,
                    parsedInsight.category as WardenCategory,
                    parsedInsight.title,
                    parsedInsight.description,
                    parsedInsight.affectedFiles,
                );
                inserted.push(insight);
            }

            if (this.onInsightsGenerated && inserted.length > 0) {
                this.onInsightsGenerated(projectId, inserted);
            }

            return inserted;
        } catch (error: unknown) {
            console.error("[Warden] Analysis failed:", error);
            return [];
        } finally {
            this.isRunning.set(projectId, false);
            this.lastRunAt.set(projectId, Date.now());
        }
    }

    onGitStatusChange(projectPath: string, snapshot: GitSnapshot): void {
        const project = getProjectByPath(this.db, projectPath);
        if (!project) return;

        const newHash = snapshot.lastCommitHash ?? null;
        const prevHash = this.lastCommitHash.get(project.id) ?? null;
        if (newHash === prevHash) return;

        this.lastCommitHash.set(project.id, newHash ?? "");
        if (!newHash) return;

        void this.analyzeProject(project.id, projectPath, false);
    }
}
