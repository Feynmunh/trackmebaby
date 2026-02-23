/**
 * RPC Bridge — wires backend services to frontend via Electrobun typed RPC
 * This module connects all services and exposes them as RPC request handlers
 */
import { BrowserView } from "electrobun/bun";
import type { TrackmeBabyRPC } from "../../shared/rpc-types.ts";
import type { Database } from "bun:sqlite";
import {
    getProjects,
    getRecentEvents,
    getLatestGitSnapshot,
} from "../db/queries.ts";
import { SettingsService } from "../services/settings.ts";
import { ProjectScanner } from "../services/project-scanner.ts";
import { createAIProvider, type AIProvider } from "../services/ai/index.ts";
import { assembleContext } from "../services/ai/context-assembler.ts";

export function createRPC(
    db: Database,
    settingsService: SettingsService,
    scanner: ProjectScanner
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

    const rpc = BrowserView.defineRPC<TrackmeBabyRPC>({
        handlers: {
            requests: {
                getProjects: () => {
                    return getProjects(db);
                },

                getProjectActivity: ({ projectId, since }) => {
                    return getRecentEvents(db, projectId, new Date(since));
                },

                getGitStatus: ({ projectId }) => {
                    return getLatestGitSnapshot(db, projectId);
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
