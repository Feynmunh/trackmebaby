import type { Database } from "bun:sqlite";
import { getProjectById } from "../../db/queries.ts";
import type { GitHubService } from "../../services/github.ts";

export interface GitHubHandlersDeps {
    db: Database;
    githubService: GitHubService;
}

export function createGitHubHandlers({
    db,
    githubService,
}: GitHubHandlersDeps) {
    return {
        githubStartAuth: () => {
            const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
            const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
            if (!clientId || !clientSecret) {
                return {
                    success: false,
                    error: "GitHub OAuth credentials not configured",
                };
            }
            return githubService.startOAuthFlow(clientId, clientSecret);
        },
        githubSignOut: () => {
            githubService.clearAuth();
            return { success: true };
        },
        getGitHubAuthStatus: () => {
            return {
                authenticated: githubService.isAuthenticated(),
                username: githubService.getUsername() ?? undefined,
            };
        },
        getGitHubData: async ({ projectId }: { projectId: string }) => {
            const project = getProjectById(db, projectId);
            if (!project) return null;
            return await githubService.getGitHubData(project.path);
        },
    };
}
