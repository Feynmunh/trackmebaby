import type { Database } from "bun:sqlite";
import { createVaultHandlers } from "./handlers.ts";

export interface VaultRegistrarDeps {
    db: Database;
}

export function registerVaultHandlers(deps: VaultRegistrarDeps) {
    return createVaultHandlers(deps);
}
