import type { Settings } from "../../../shared/types.ts";
import type { ProjectScanner } from "../../services/project-scanner.ts";
import type { SettingsService } from "../../services/settings.ts";

export interface SettingsHandlersDeps {
    settingsService: SettingsService;
    scanner: ProjectScanner;
    resetAIProvider: () => void;
}

export function createSettingsHandlers({
    settingsService,
    scanner,
    resetAIProvider,
}: SettingsHandlersDeps) {
    return {
        getSettings: () => {
            return settingsService.getAll();
        },
        updateSettings: ({ settings }: { settings: Partial<Settings> }) => {
            settingsService.updateMany(settings);
            resetAIProvider();
            return { success: true };
        },
        scanProjects: async ({ basePath }: { basePath: string }) => {
            const projects = await scanner.scan(basePath);
            settingsService.setBasePath(basePath);
            return projects;
        },
    };
}
