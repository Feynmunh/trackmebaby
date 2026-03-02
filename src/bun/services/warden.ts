import type { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join, normalize, sep } from "node:path";
import type {
    GitSnapshot,
    WardenCategory,
    WardenInsight,
    WardenSeverity,
} from "../../shared/types.ts";
import {
    cleanupWardenInsights,
    getProjectById,
    getProjectByPath,
    insertWardenInsight,
} from "../db/queries.ts";
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

interface QueueEntry {
    projectId: string;
    isManual: boolean;
    resolve: (insights: WardenInsight[]) => void;
}

export class WardenService {
    private db: Database;
    private settingsService: SettingsService;
    private lastRunAt: Map<string, number> = new Map();
    private isRunning: Map<string, boolean> = new Map();
    private lastCommitHash: Map<string, string> = new Map();
    private onInsightsGenerated?: InsightsCallback;
    private readonly COOLDOWN_MS = 5 * 60 * 1000;
    private readonly MANUAL_COOLDOWN_MS = 60 * 1000;
    private readonly MAX_RETRIES = 1;
    private readonly WARDEN_MAX_TOKENS = 2048;
    private readonly MAX_CONCURRENT = 2;
    private activeCount = 0;
    private queue: QueueEntry[] = [];

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

        const lastRun = this.lastRunAt.get(projectId) ?? 0;
        const cooldown = isManual ? this.MANUAL_COOLDOWN_MS : this.COOLDOWN_MS;
        if (Date.now() - lastRun < cooldown) {
            return [];
        }

        if (this.isRunning.get(projectId) === true) {
            return [];
        }

        // Check if already queued
        if (this.queue.some((e) => e.projectId === projectId)) {
            return [];
        }

        // Route through global queue
        return new Promise<WardenInsight[]>((resolve) => {
            // Manual triggers go to front of queue
            const entry: QueueEntry = { projectId, isManual, resolve };
            if (isManual) {
                this.queue.unshift(entry);
            } else {
                this.queue.push(entry);
            }
            this.processQueue();
        });
    }

    private processQueue(): void {
        while (
            this.queue.length > 0 &&
            this.activeCount < this.MAX_CONCURRENT
        ) {
            const entry = this.queue.shift()!;
            this.activeCount++;
            void this.executeAnalysis(entry.projectId)
                .then((insights) => entry.resolve(insights))
                .finally(() => {
                    this.activeCount--;
                    this.processQueue();
                });
        }
    }

    private async executeAnalysis(projectId: string): Promise<WardenInsight[]> {
        if (this.isRunning.get(projectId) === true) {
            return [];
        }

        this.isRunning.set(projectId, true);
        const provider = this.getAIProvider();

        try {
            // Clean up old insights before analysis to keep context fresh
            cleanupWardenInsights(this.db, projectId);

            const project = getProjectById(this.db, projectId);
            const projectRoot = project?.path ?? null;
            const context = await assembleWardenContext(
                this.db,
                projectId,
                projectRoot,
            );

            // Query AI with retry on JSON parse failure
            const parsedInsights = await this.queryWithRetry(provider, context);

            // Validate affectedFiles: strip paths that don't exist on disk or are outside projectRoot
            for (const insight of parsedInsights) {
                if (insight.affectedFiles && projectRoot) {
                    insight.affectedFiles = insight.affectedFiles.filter(
                        (filePath) => {
                            // 1. Reject absolute paths and null/empty
                            if (
                                !filePath ||
                                filePath.startsWith("/") ||
                                filePath.includes(":\\")
                            ) {
                                return false;
                            }

                            // 2. Resolve and normalize, then check for path traversal (stay within projectRoot)
                            const abs = normalize(join(projectRoot, filePath));
                            if (!abs.startsWith(projectRoot + sep)) {
                                return false;
                            }

                            // 3. Verify existence on disk
                            return existsSync(abs);
                        },
                    );
                    if (insight.affectedFiles.length === 0) {
                        insight.affectedFiles = null;
                    }
                }
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

    private async queryWithRetry(provider: AIProvider, context: string) {
        for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
            const aiText = await provider.query(
                context,
                "Analyze this project activity for potential issues.",
                WARDEN_SYSTEM_PROMPT,
                { maxTokens: this.WARDEN_MAX_TOKENS, jsonMode: true },
            );

            // Check for API-level error
            if (aiText.includes("AI query failed")) {
                throw new Error(aiText);
            }

            const insights = parseWardenResponse(aiText);
            if (insights.length > 0) {
                return insights;
            }

            // Parse returned empty (malformed JSON) — retry once
            if (attempt < this.MAX_RETRIES) {
                console.warn(
                    `[Warden] Parse failed, retrying (attempt ${attempt + 1})...`,
                );
            }
        }
        return [];
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

    /**
     * Run initial analysis for a set of projects with staggered delays.
     * First project runs immediately, others are staggered by 30s.
     */
    scheduleInitialAnalysis(projectIds: string[]): void {
        if (projectIds.length === 0) return;
        const apiKey = getSavedApiKey();
        if (!apiKey) return;

        console.log(
            `[Warden] Scheduling initial analysis for ${projectIds.length} projects`,
        );

        // First project immediately
        void this.analyzeProject(projectIds[0], false);

        // Remaining projects staggered
        const STAGGER_MS = 30_000;
        for (let i = 1; i < projectIds.length; i++) {
            const id = projectIds[i];
            setTimeout(() => {
                void this.analyzeProject(id, false);
            }, i * STAGGER_MS);
        }
    }
}
