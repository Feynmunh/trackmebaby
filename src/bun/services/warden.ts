import type { Database } from "bun:sqlite";
import type {
    GitSnapshot,
    WardenCategory,
    WardenInsight,
    WardenSeverity,
} from "../../shared/types.ts";
import { getProjectByPath, insertWardenInsight } from "../db/queries.ts";
import {
    type AIProvider,
    createAIProvider,
    getSavedApiKey,
} from "./ai/index.ts";
import { assembleWardenContext } from "./ai/warden-context.ts";
import {
    parseWardenResponse,
    WARDEN_SYSTEM_PROMPT,
} from "./ai/warden-prompt.ts";
import type { SettingsService } from "./settings.ts";

type InsightsCallback = (projectId: string, insights: WardenInsight[]) => void;

export class WardenService {
    private db: Database;
    private settingsService: SettingsService;
    private lastRunAt: Map<string, number> = new Map();
    private isRunning: Map<string, boolean> = new Map();
    private lastCommitHash: Map<string, string> = new Map();
    private onInsightsGenerated?: InsightsCallback;
    private readonly COOLDOWN_MS = 5 * 60 * 1000;

    constructor(
        db: Database,
        settingsService: SettingsService,
        onInsightsGenerated?: InsightsCallback,
    ) {
        this.db = db;
        this.settingsService = settingsService;
        this.onInsightsGenerated = onInsightsGenerated;
    }

    private getAIProvider(): AIProvider {
        const settings = this.settingsService.getAll();
        return createAIProvider({
            provider: settings.aiProvider,
            apiKey: getSavedApiKey(),
            model: settings.aiModel,
        });
    }

    async analyzeProject(
        projectId: string,
        isManual: boolean = false,
    ): Promise<WardenInsight[]> {
        const apiKey = getSavedApiKey();
        if (!apiKey) {
            console.log("[Warden] No API key configured, skipping analysis");
            return [];
        }

        const provider = this.getAIProvider();

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
            const aiText = await provider.query(
                context,
                "Analyze this project activity for potential issues.",
                WARDEN_SYSTEM_PROMPT,
            );

            // AIProvider implementations currently return a user-friendly error string
            // if response.ok is false. parseWardenResponse will return [] for those.
            const parsedInsights = parseWardenResponse(aiText);

            if (
                parsedInsights.length === 0 &&
                aiText.includes("AI query failed")
            ) {
                throw new Error(aiText);
            }

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

            this.lastRunAt.set(projectId, Date.now());
            return inserted;
        } catch (error: unknown) {
            console.error("[Warden] Analysis failed:", error);
            // Backoff on failure: set lastRunAt with half the normal cooldown to avoid hammering
            this.lastRunAt.set(projectId, Date.now() - this.COOLDOWN_MS / 2);
            return [];
        } finally {
            this.isRunning.set(projectId, false);
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

        void this.analyzeProject(project.id, false);
    }
}
