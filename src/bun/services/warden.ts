import type { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join, normalize, sep } from "node:path";
import type {
    WardenCategory,
    WardenInsight,
    WardenSeverity,
} from "../../shared/types.ts";
import {
    cleanupWardenInsights,
    getProjectById,
    hasEventsSince,
    hasGitSnapshots,
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
type FailureCallback = (projectId: string, reason: string) => void;

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
    private onInsightsGenerated?: InsightsCallback;
    private onAnalysisFailed?: FailureCallback;
    private readonly COOLDOWN_MS = 5 * 60 * 1000;
    private readonly MANUAL_COOLDOWN_MS = 15 * 1000; // 15 seconds for manual
    private readonly FIRST_RUN_COOLDOWN_MS = 30 * 1000; // 30 seconds for first run
    private readonly MAX_RETRIES = 1;
    private readonly WARDEN_MAX_TOKENS = 2048;
    private readonly MAX_CONCURRENT = 2;
    private activeCount = 0;
    private queue: QueueEntry[] = [];

    constructor(
        db: Database,
        settingsService: SettingsService,
        onInsightsGenerated?: InsightsCallback,
        onAnalysisFailed?: FailureCallback,
    ) {
        this.db = db;
        this.settingsService = settingsService;
        this.onInsightsGenerated = onInsightsGenerated;
        this.onAnalysisFailed = onAnalysisFailed;
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

    /**
     * Analyze project only if:
     * - Has activity (file events OR git commits)
     * - Cooldown has passed
     * - New activity since last analysis (or first run)
     *
     * Returns reason for why analysis was/wasn't triggered.
     */
    async analyzeProjectIfNeeded(
        projectId: string,
        isManual: boolean = false,
    ): Promise<{ success: boolean; insightCount: number; reason: string }> {
        const apiKey = getSavedApiKey();
        if (!apiKey) {
            return { success: false, insightCount: 0, reason: "NO_API_KEY" };
        }

        const project = getProjectById(this.db, projectId);
        if (!project) {
            return {
                success: false,
                insightCount: 0,
                reason: "PROJECT_NOT_FOUND",
            };
        }

        // Check if already running or queued
        if (this.isRunning.get(projectId) === true) {
            return {
                success: false,
                insightCount: 0,
                reason: "ALREADY_RUNNING",
            };
        }
        if (this.queue.some((e) => e.projectId === projectId)) {
            return { success: false, insightCount: 0, reason: "QUEUED" };
        }

        // Cooldown check using in-memory lastRunAt (handles failures!)
        const lastRun = this.lastRunAt.get(projectId) ?? 0;
        const now = Date.now();
        const cooldown = isManual ? this.MANUAL_COOLDOWN_MS : this.COOLDOWN_MS;
        if (now - lastRun < cooldown) {
            return { success: false, insightCount: 0, reason: "COOLDOWN" };
        }

        // Check if project has ANY activity (file events OR git commits)
        const hasFileActivity = project.lastActivityAt !== null;
        const hasGitActivity = hasGitSnapshots(this.db, projectId);
        if (!hasFileActivity && !hasGitActivity) {
            return {
                success: false,
                insightCount: 0,
                reason: "NO_ACTIVITY_EVER",
            };
        }

        // Get last successful analysis time from insights
        const lastInsightRow = this.db
            .query(
                "SELECT MAX(created_at) as last_created FROM warden_insights WHERE project_id = ?",
            )
            .get(projectId) as { last_created: string | null } | null;
        const lastInsightCreated = lastInsightRow?.last_created;

        // First-run case: never analyzed before
        if (!lastInsightCreated) {
            // First-run specific cooldown
            if (now - lastRun < this.FIRST_RUN_COOLDOWN_MS) {
                return {
                    success: false,
                    insightCount: 0,
                    reason: "FIRST_RUN_COOLDOWN",
                };
            }
            void this.analyzeProject(projectId, isManual);
            return {
                success: true,
                insightCount: 0,
                reason: "FIRST_RUN",
            };
        }

        // Check for new activity since last analysis
        const lastAnalyzedAt = new Date(lastInsightCreated);
        const hasNewEvents = hasEventsSince(this.db, projectId, lastAnalyzedAt);
        const hasNewCommits = this.hasNewCommitsSince(
            projectId,
            lastAnalyzedAt,
        );

        if (!hasNewEvents && !hasNewCommits) {
            return {
                success: false,
                insightCount: 0,
                reason: "NO_NEW_ACTIVITY",
            };
        }

        // Run analysis (fire and forget, result comes via RPC message)
        void this.analyzeProject(projectId, isManual);
        return {
            success: true,
            insightCount: 0,
            reason: "NEW_ACTIVITY",
        };
    }

    /**
     * Check if there are new commits since a given time.
     */
    private hasNewCommitsSince(projectId: string, since: Date): boolean {
        const result = this.db
            .query(
                "SELECT 1 FROM git_snapshots WHERE project_id = ? AND last_commit_timestamp > ? LIMIT 1",
            )
            .get(projectId, since.toISOString());
        return result !== null;
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
            const reason =
                error instanceof Error ? error.message : "Unknown error";
            if (this.onAnalysisFailed) {
                this.onAnalysisFailed(projectId, reason);
            }
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
}
