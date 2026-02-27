/**
 * RPC Bridge — wires backend services to frontend via Electrobun typed RPC
 * This module connects all services and exposes them as RPC request handlers
 */

import type { Database } from "bun:sqlite";
import { BrowserView, type BrowserWindow } from "electrobun/bun";
import type { TrackmeBabyRPC } from "../../shared/rpc-types.ts";
import { type AIProvider, createAIProvider } from "../services/ai/index.ts";
import type { GitTrackerService } from "../services/git-tracker.ts";
import { GitHubService } from "../services/github.ts";
import type { ProjectScanner } from "../services/project-scanner.ts";
import type { SettingsService } from "../services/settings.ts";
import { createAIHandlers } from "./handlers/ai.ts";
import { createGitHandlers } from "./handlers/git.ts";
import { createGitHubHandlers } from "./handlers/github.ts";
import { createProjectHandlers } from "./handlers/projects.ts";
import { createSettingsHandlers } from "./handlers/settings.ts";
import { createSystemHandlers } from "./handlers/system.ts";
import { createWindowHandlers } from "./handlers/window.ts";

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

    const rpc = BrowserView.defineRPC<TrackmeBabyRPC>({
        maxRequestTime: 15000,
        handlers: {
            requests: {
                ...createProjectHandlers({ db }),
                ...createGitHandlers({ db, gitTracker }),
                ...createAIHandlers({ db, getAIProvider }),
                ...createSettingsHandlers({
                    settingsService,
                    scanner,
                    resetAIProvider: () => {
                        aiProvider = null;
                    },
                }),
                ...createGitHubHandlers({ db, githubService }),
                ...createWindowHandlers({ getMainWindow }),
            },
            messages: createSystemHandlers(),
        },
    });

    return rpc;
}
