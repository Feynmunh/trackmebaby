import type { Project } from "../../../../shared/types.ts";
import type { ProjectScanner } from "../../../services/project-scanner.ts";
import type { SettingsService } from "../../../services/settings.ts";
import { createSettingsHandlers } from "./handlers.ts";

export interface SettingsRegistrarDeps {
    settingsService: SettingsService;
    scanner: ProjectScanner;
    resetAIProvider: () => void;
    onProjectsScanned?: (projects: Project[]) => void;
}

export function registerSettingsHandlers({
    settingsService,
    scanner,
    resetAIProvider,
    onProjectsScanned,
}: SettingsRegistrarDeps) {
    return createSettingsHandlers({
        settingsService,
        scanner,
        resetAIProvider,
        onProjectsScanned,
    });
}
