/**
 * RPC Bridge — wires backend services to frontend via Electrobun typed RPC
 * This module connects all services and exposes them as RPC request handlers
 */

import type { Database } from "bun:sqlite";
import { BrowserView, type BrowserWindow } from "electrobun/bun";
import { toErrorData, toErrorMessage } from "../../shared/error.ts";
import { createLogger, emitLog } from "../../shared/logger.ts";
import type { TrackmeBabyRPC } from "../../shared/rpc-types.ts";
import type { Settings } from "../../shared/types.ts";
import {
    getActivitySummary,
    getLatestGitSnapshot,
    getProjectById,
    getProjects,
    getRecentEvents,
} from "../db/queries.ts";
import { assembleContext } from "../services/ai/context-assembler.ts";
import { type AIProvider, createAIProvider } from "../services/ai/index.ts";
import type { GitTrackerService } from "../services/git-tracker.ts";
import { GitHubService } from "../services/github.ts";
import type { ProjectScanner } from "../services/project-scanner.ts";
import type { SettingsService } from "../services/settings.ts";

type BrowserWindowInstance = InstanceType<typeof BrowserWindow>;

export function createRPC(
    db: Database,
    settingsService: SettingsService,
    scanner: ProjectScanner,
    gitTracker: GitTrackerService,
    getMainWindow: () => BrowserWindowInstance | null,
) {
    // Create AI provider from current settings
    let aiProvider: AIProvider | null = null;

    function getAIProvider(): AIProvider {
        if (!aiProvider) {
            const settings = settingsService.getAll();
            aiProvider = createAIProvider({
                provider: settings.aiProvider,
                apiKey: getSavedApiKey(),
                model: settings.aiModel,
            });
        }
        return aiProvider;
    }

    // Simple API key storage (env var or file-based)
    function getSavedApiKey(): string {
        return process.env.GROQ_API_KEY || process.env.AI_API_KEY || "";
    }

    // GitHub service
    const githubService = new GitHubService(db);
    const logger = createLogger("rpc");

    const rpc = BrowserView.defineRPC<TrackmeBabyRPC>({
        handlers: {
            requests: {
                getProjects: () => {
                    return getProjects(db);
                },

                getProjectActivity: ({
                    projectId,
                    since,
                }: {
                    projectId: string;
                    since: string;
                }) => {
                    return getRecentEvents(
                        db,
                        projectId,
                        new Date(since),
                        20000,
                    );
                },
                getProjectActivitySummary: ({
                    projectId,
                    since,
                    until,
                }: {
                    projectId: string;
                    since: string;
                    until: string;
                }) => {
                    return getActivitySummary(
                        db,
                        projectId,
                        new Date(since),
                        new Date(until),
                    );
                },

                getGitStatus: async ({ projectId }: { projectId: string }) => {
                    // Try DB first (fast)
                    const cached = getLatestGitSnapshot(db, projectId);
                    if (cached) return cached;

                    // No snapshot yet — live fetch and store so the UI isn't empty
                    const project = getProjectById(db, projectId);
                    if (!project) return null;
                    try {
                        const snapshot = await gitTracker.getSnapshot(
                            project.path,
                        );
                        if (!snapshot) return null;
                        // Store it so subsequent calls are instant
                        const { insertGitSnapshot } = await import(
                            "../db/queries.ts"
                        );
                        return insertGitSnapshot(
                            db,
                            project.id,
                            snapshot.branch,
                            snapshot.lastCommitHash,
                            snapshot.lastCommitMessage,
                            snapshot.lastCommitTimestamp,
                            snapshot.uncommittedCount,
                            snapshot.uncommittedFiles,
                            snapshot.diffStats ?? undefined,
                        );
                    } catch (err: unknown) {
                        logger.error("git snapshot error", {
                            error: toErrorData(err),
                        });
                        return null;
                    }
                },
                getProjectStats: async ({
                    projectId,
                }: {
                    projectId: string;
                }) => {
                    const project = getProjectById(db, projectId);
                    if (!project) return null;
                    return await gitTracker.getProjectStats(project.path);
                },

                queryAI: async ({ question }: { question: string }) => {
                    try {
                        const context = assembleContext(db, question);
                        const provider = getAIProvider();
                        return await provider.query(context, question);
                    } catch (err: unknown) {
                        const message = toErrorMessage(err);
                        logger.error("ai query error", {
                            error: toErrorData(err),
                        });
                        return `Error: ${message}`;
                    }
                },

                getSettings: () => {
                    return settingsService.getAll();
                },

                updateSettings: ({
                    settings,
                }: {
                    settings: Partial<Settings>;
                }) => {
                    settingsService.updateMany(settings);
                    // Reset AI provider so next query uses new settings
                    aiProvider = null;
                    return { success: true };
                },

                scanProjects: async ({ basePath }: { basePath: string }) => {
                    const projects = await scanner.scan(basePath);
                    settingsService.setBasePath(basePath);
                    return projects;
                },

                getPlatform: () => {
                    return process.platform;
                },

                windowMinimize: () => {
                    const win = getMainWindow();
                    if (win) {
                        win.minimize();
                        return { success: true };
                    }
                    return { success: false };
                },

                windowMaximize: () => {
                    const win = getMainWindow();
                    if (win) {
                        if (win.isMaximized()) {
                            win.unmaximize();
                        } else {
                            win.maximize();
                        }
                        return { success: true };
                    }
                    return { success: false };
                },

                windowClose: () => {
                    const win = getMainWindow();
                    if (win) {
                        win.close();
                        return { success: true };
                    }
                    return { success: false };
                },

                windowGetPosition: () => {
                    const win = getMainWindow();
                    if (win) {
                        return win.getPosition();
                    }
                    return { x: 0, y: 0 };
                },

                windowSetPosition: ({ x, y }: { x: number; y: number }) => {
                    const win = getMainWindow();
                    if (win) {
                        win.setPosition(x, y);
                        return { success: true };
                    }
                    return { success: false };
                },

                // --- GitHub Integration ---

                githubStartAuth: () => {
                    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
                    const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
                    if (!clientId || !clientSecret) {
                        return {
                            success: false,
                            error: "GitHub OAuth credentials not configured",
                        };
                    }
                    return githubService.startOAuthFlow(clientId, clientSecret);
                },

                githubSignOut: () => {
                    githubService.clearAuth();
                    return { success: true };
                },

                getGitHubAuthStatus: () => {
                    return {
                        authenticated: githubService.isAuthenticated(),
                        username: githubService.getUsername() ?? undefined,
                    };
                },

                getGitHubData: async ({ projectId }: { projectId: string }) => {
                    const project = getProjectById(db, projectId);
                    if (!project) return null;
                    return await githubService.getGitHubData(project.path);
                },

                openExternalUrl: ({ url }: { url: string }) => {
                    try {
                        const isLinux = process.platform === "linux";
                        const isMac = process.platform === "darwin";
                        const isWindows = process.platform === "win32";

                        if (isMac) {
                            Bun.spawn(["open", url], {
                                detached: true,
                                stdio: ["ignore", "ignore", "ignore"],
                            }).unref();
                        } else if (isWindows) {
                            Bun.spawn(["cmd", "/c", "start", url], {
                                detached: true,
                                stdio: ["ignore", "ignore", "ignore"],
                            }).unref();
                        } else if (isLinux) {
                            Bun.spawn(["xdg-open", url], {
                                detached: true,
                                stdio: ["ignore", "ignore", "ignore"],
                            }).unref();
                        }
                        return { success: true };
                    } catch (err: unknown) {
                        return { success: false, error: toErrorMessage(err) };
                    }
                },
            },
            messages: {
                log: ({
                    entry,
                }: {
                    entry: import("../../shared/logger.ts").LogEntry;
                }) => {
                    emitLog(entry);
                },
            },
        },
    });

    return rpc;
}
