import { homedir } from "node:os";
import { Utils } from "electrobun/bun";
import type { Project, Settings } from "../../../../shared/types.ts";
import type { ProjectScanner } from "../../../services/project-scanner.ts";
import type { SettingsService } from "../../../services/settings.ts";

export interface SettingsHandlersDeps {
    settingsService: SettingsService;
    scanner: ProjectScanner;
    resetAIProvider: () => void;
    onProjectsScanned?: (projects: Project[]) => void;
}

export function createSettingsHandlers({
    settingsService,
    scanner,
    resetAIProvider,
    onProjectsScanned,
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
            // Expand ~ to home directory
            let expandedPath = basePath;
            if (basePath.startsWith("~/")) {
                expandedPath = `${homedir()}/${basePath.slice(2)}`;
            }
            const projects = await scanner.scan(expandedPath);
            settingsService.setBasePath(expandedPath);
            onProjectsScanned?.(projects);
            return projects;
        },
        selectFolder: async ({ defaultPath }: { defaultPath?: string }) => {
            try {
                console.log(
                    "[selectFolder] Opening dialog, starting folder:",
                    defaultPath,
                );
                // biome-ignore lint/suspicious/noExplicitAny: Electrobun Utils type definition is incomplete
                const filePaths = await (Utils as any).openFileDialog({
                    startingFolder: defaultPath || "/home",
                    canChooseDirectory: true,
                });
                console.log("[selectFolder] Dialog returned:", filePaths);
                if (!filePaths || filePaths.length === 0) {
                    console.log("[selectFolder] No folder selected");
                    return null;
                }
                console.log("[selectFolder] Selected folder:", filePaths[0]);
                return filePaths[0];
            } catch (err) {
                console.error("[selectFolder] Error:", err);
                return null;
            }
        },
    };
}
