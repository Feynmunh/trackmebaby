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
import { registerAIHandlers } from "./features/ai/registrar.ts";
import { registerGitHandlers } from "./features/git/registrar.ts";
import { registerGitHubHandlers } from "./features/github/registrar.ts";
import { registerProjectHandlers } from "./features/projects/registrar.ts";
import { registerSettingsHandlers } from "./features/settings/registrar.ts";
import { registerSystemHandlers } from "./features/system/registrar.ts";
import { registerWindowHandlers } from "./features/window/registrar.ts";

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
                ...registerProjectHandlers({ db }),
                ...registerGitHandlers({ db, gitTracker }),
                ...registerAIHandlers({ db, getAIProvider }),
                ...registerSettingsHandlers({
                    settingsService,
                    scanner,
                    resetAIProvider: () => {
                        aiProvider = null;
                    },
                }),
                ...registerGitHubHandlers({ db, githubService }),
                ...registerWindowHandlers({ getMainWindow }),
            },
            messages: registerSystemHandlers(),
        },
    });

    return rpc;
}
