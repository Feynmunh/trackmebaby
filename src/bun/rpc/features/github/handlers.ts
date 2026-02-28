import type { Database } from "bun:sqlite";
import { isIsoWithinMs } from "../../../../shared/time.ts";
import type { GitHubData } from "../../../../shared/types.ts";
import { getGitHubCache, getProjectById } from "../../../db/queries.ts";
import type { GitHubService } from "../../../services/github.ts";

export interface GitHubHandlersDeps {
    db: Database;
    githubService: GitHubService;
}

const GITHUB_CACHE_TTL_MS = 10 * 60 * 1000;
const githubInflight = new Map<string, Promise<GitHubData | null>>();

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
            const cache = getGitHubCache(db, projectId);
            if (
                cache.data &&
                isIsoWithinMs(cache.updatedAt, GITHUB_CACHE_TTL_MS)
            ) {
                return cache.data;
            }

            const cachedData = cache.data;
            if (cachedData) {
                if (!githubInflight.has(projectId)) {
                    const pending = githubService
                        .getGitHubData(project.path)
                        .finally(() => {
                            githubInflight.delete(projectId);
                        });
                    githubInflight.set(projectId, pending);
                }

                const refreshedData = await (githubInflight.get(projectId) ??
                    null);
                if (refreshedData) {
                    return refreshedData;
                }

                if (!githubService.isAuthenticated()) {
                    return null;
                }

                return cachedData;
            }

            if (githubInflight.has(projectId)) {
                return await (githubInflight.get(projectId) ?? null);
            }
            const pending = githubService
                .getGitHubData(project.path)
                .finally(() => {
                    githubInflight.delete(projectId);
                });
            githubInflight.set(projectId, pending);
            return await pending;
        },
    };
}
