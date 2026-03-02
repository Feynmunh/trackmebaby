import type { Database } from "bun:sqlite";
import type { WardenService } from "../../../services/warden.ts";
import { createWardenHandlers } from "./handlers.ts";

export interface WardenRegistrarDeps {
    db: Database;
    wardenService: WardenService;
}

export function registerWardenHandlers(deps: WardenRegistrarDeps) {
    return createWardenHandlers(deps);
}
