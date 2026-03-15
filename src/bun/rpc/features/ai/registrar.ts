import type { Database } from "bun:sqlite";
import type { AIProvider } from "../../../services/ai/index.ts";
import { createAIHandlers } from "./handlers.ts";

export interface AIRegistrarDeps {
    db: Database;
    getAIProvider: () => Promise<AIProvider>;
}

export function registerAIHandlers({ db, getAIProvider }: AIRegistrarDeps) {
    return createAIHandlers({ db, getAIProvider });
}
