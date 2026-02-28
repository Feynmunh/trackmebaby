import type { Database } from "bun:sqlite";
import { createProjectHandlers } from "./handlers.ts";

export interface ProjectRegistrarDeps {
    db: Database;
}

export function registerProjectHandlers({ db }: ProjectRegistrarDeps) {
    return createProjectHandlers({ db });
}
