import type { Database } from "bun:sqlite";
import type { GitHubService } from "../../../services/github.ts";
import { createGitHubHandlers } from "./handlers.ts";

export interface GitHubRegistrarDeps {
    db: Database;
    githubService: GitHubService;
}

export function registerGitHubHandlers({
    db,
    githubService,
}: GitHubRegistrarDeps) {
    return createGitHubHandlers({ db, githubService });
}
