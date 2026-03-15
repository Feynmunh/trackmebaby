import type { Database } from "bun:sqlite";
import type { AISecretStore } from "../../../services/ai/index.ts";
import type { SettingsService } from "../../../services/settings.ts";
import type { WardenService } from "../../../services/warden.ts";
import { createWardenHandlers } from "./handlers.ts";

export interface WardenRegistrarDeps {
    db: Database;
    wardenService: WardenService;
    settingsService: SettingsService;
    aiSecretStore: AISecretStore;
}

export function registerWardenHandlers(deps: WardenRegistrarDeps) {
    return createWardenHandlers(deps);
}
