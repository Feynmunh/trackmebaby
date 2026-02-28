import type { Database } from "bun:sqlite";
import type { GitTrackerService } from "../../../services/git-tracker.ts";
import { createGitHandlers } from "./handlers.ts";

export interface GitRegistrarDeps {
    db: Database;
    gitTracker: GitTrackerService;
}

export function registerGitHandlers({ db, gitTracker }: GitRegistrarDeps) {
    return createGitHandlers({ db, gitTracker });
}
