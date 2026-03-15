/**
 * RPC Bridge — wires backend services to frontend via Electrobun typed RPC
 * This module connects all services and exposes them as RPC request handlers
 */

import type { Database } from "bun:sqlite";
import { BrowserView, type BrowserWindow } from "electrobun/bun";
import { normalizeAIModel } from "../../shared/ai-models.ts";
import type { TrackmeBabyRPC } from "../../shared/rpc-types.ts";
import {
    type AIProvider,
    type AISecretStore,
    createAIProvider,
    getSavedApiKey,
    resolveAIProvider,
} from "../services/ai/index.ts";
import type { GitTrackerService } from "../services/git-tracker.ts";
import { GitHubService } from "../services/github.ts";
import type { ProjectScanner } from "../services/project-scanner.ts";
import type { SettingsService } from "../services/settings.ts";
import type { WardenService } from "../services/warden.ts";
import { registerAIHandlers } from "./features/ai/registrar.ts";
import { registerGitHandlers } from "./features/git/registrar.ts";
import { registerGitHubHandlers } from "./features/github/registrar.ts";
import { registerProjectHandlers } from "./features/projects/registrar.ts";
import { registerSettingsHandlers } from "./features/settings/registrar.ts";
import {
    registerSystemMessageHandlers,
    registerSystemRequestHandlers,
} from "./features/system/registrar.ts";
import { registerVaultHandlers } from "./features/vault/registrar.ts";
import { registerWardenHandlers } from "./features/warden/registrar.ts";
import { registerWindowHandlers } from "./features/window/registrar.ts";

export function createRPC(
    db: Database,
    settingsService: SettingsService,
    scanner: ProjectScanner,
    gitTracker: GitTrackerService,
    wardenService: WardenService,
    aiSecretStore: AISecretStore,
    getMainWindow: () => InstanceType<typeof BrowserWindow> | null,
) {
    // Create AI provider from current settings
    let aiProvider: AIProvider | null = null;

    async function getAIProvider(): Promise<AIProvider> {
        if (!aiProvider) {
            const settings = settingsService.getAll();
            const provider = resolveAIProvider(settings.aiProvider);
            const apiKey = await getSavedApiKey(aiSecretStore, provider);
            aiProvider = createAIProvider({
                provider,
                apiKey,
                model: normalizeAIModel(provider, settings.aiModel),
            });
        }
        return aiProvider;
    }

    // Simple API key storage (env var or file-based)

    // GitHub service
    const githubService = new GitHubService(db);

    const rpc = BrowserView.defineRPC<TrackmeBabyRPC>({
        maxRequestTime: 30000,
        handlers: {
            requests: {
                ...registerProjectHandlers({ db }),
                ...registerGitHandlers({ db, gitTracker }),
                ...registerAIHandlers({ db, getAIProvider }),
                ...registerSettingsHandlers({
                    settingsService,
                    scanner,
                    aiSecretStore,
                    getAIProvider,
                    resetAIProvider: () => {
                        aiProvider = null;
                    },
                }),
                ...registerGitHubHandlers({ db, githubService }),
                ...registerWardenHandlers({
                    db,
                    wardenService,
                    settingsService,
                    aiSecretStore,
                }),
                ...registerVaultHandlers({ db }),
                ...registerWindowHandlers({ getMainWindow }),
                ...registerSystemRequestHandlers(),
            },
            messages: registerSystemMessageHandlers(),
        },
    });

    return rpc;
}
