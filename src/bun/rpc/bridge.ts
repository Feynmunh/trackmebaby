/**
 * RPC Bridge — wires backend services to frontend via Electrobun typed RPC
 * This module connects all services and exposes them as RPC request handlers
 */
import { BrowserView, BrowserWindow } from "electrobun/bun";
import type { TrackmeBabyRPC } from "../../shared/rpc-types.ts";
import type { Database } from "bun:sqlite";
import {
    getProjects,
    getRecentEvents,
    getLatestGitSnapshot,
    getProjectById,
} from "../db/queries.ts";
import { SettingsService } from "../services/settings.ts";
import { ProjectScanner } from "../services/project-scanner.ts";
import { GitTrackerService } from "../services/git-tracker.ts";
import { createAIProvider, type AIProvider } from "../services/ai/index.ts";
import { assembleContext } from "../services/ai/context-assembler.ts";
import { GitHubService } from "../services/github.ts";

export function createRPC(
    db: Database,
    settingsService: SettingsService,
    scanner: ProjectScanner,
    gitTracker: GitTrackerService,
    getMainWindow: () => BrowserWindow | null
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

    const rpc = BrowserView.defineRPC<TrackmeBabyRPC>({
        handlers: {
            requests: {
                getProjects: () => {
                    return getProjects(db);
                },

                getProjectActivity: ({ projectId, since }) => {
                    return getRecentEvents(db, projectId, new Date(since));
                },

                getGitStatus: async ({ projectId }) => {
                    // Try DB first (fast)
                    const cached = getLatestGitSnapshot(db, projectId);
                    if (cached) return cached;

                    // No snapshot yet — live fetch and store so the UI isn't empty
                    const project = getProjectById(db, projectId);
                    if (!project) return null;
                    try {
                        const snapshot = await gitTracker.getSnapshot(project.path);
                        if (!snapshot) return null;
                        // Store it so subsequent calls are instant
                        const { insertGitSnapshot } = await import("../db/queries.ts");
                        return insertGitSnapshot(
                            db,
                            project.id,
                            snapshot.branch,
                            snapshot.lastCommitHash,
                            snapshot.lastCommitMessage,
                            snapshot.lastCommitTimestamp,
                            snapshot.uncommittedCount,
                            snapshot.uncommittedFiles,
                            snapshot.diffStats ?? undefined
                        );
                    } catch {
                        return null;
                    }
                },
                getProjectStats: async ({ projectId }) => {
                    const project = getProjectById(db, projectId);
                    if (!project) return null;
                    return await gitTracker.getProjectStats(project.path);
                },

                queryAI: async ({ question }) => {
                    try {
                        const context = assembleContext(db, question);
                        const provider = getAIProvider();
                        return await provider.query(context, question);
                    } catch (err: any) {
                        console.error("[RPC] AI query error:", err.message);
                        return `Error: ${err.message}`;
                    }
                },

                getSettings: () => {
                    return settingsService.getAll();
                },

                updateSettings: ({ settings }) => {
                    settingsService.updateMany(settings);
                    // Reset AI provider so next query uses new settings
                    aiProvider = null;
                    return { success: true };
                },

                scanProjects: async ({ basePath }) => {
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

                windowSetPosition: ({ x, y }) => {
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
                        return { success: false, error: "GitHub OAuth credentials not configured" };
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

                getGitHubData: async ({ projectId }) => {
                    const project = getProjectById(db, projectId);
                    if (!project) return null;
                    return await githubService.getGitHubData(project.path);
                },
            },
            messages: {
                log: ({ msg }) => {
                    console.log("[Frontend]", msg);
                },
            },
        },
    });

    return rpc;
}

