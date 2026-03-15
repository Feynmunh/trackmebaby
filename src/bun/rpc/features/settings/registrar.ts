import type { AIProvider, AISecretStore } from "../../../services/ai/index.ts";
import type { ProjectScanner } from "../../../services/project-scanner.ts";
import type { SettingsService } from "../../../services/settings.ts";
import { createSettingsHandlers } from "./handlers.ts";

export interface SettingsRegistrarDeps {
    settingsService: SettingsService;
    scanner: ProjectScanner;
    aiSecretStore: AISecretStore;
    getAIProvider: () => Promise<AIProvider>;
    resetAIProvider: () => void;
}

export function registerSettingsHandlers({
    settingsService,
    scanner,
    aiSecretStore,
    getAIProvider,
    resetAIProvider,
}: SettingsRegistrarDeps) {
    return createSettingsHandlers({
        settingsService,
        scanner,
        aiSecretStore,
        getAIProvider,
        resetAIProvider,
    });
}
