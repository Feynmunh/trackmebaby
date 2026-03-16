import type { Database } from "bun:sqlite";
import { toErrorMessage } from "../../../../shared/error.ts";
import { isIsoWithinMs } from "../../../../shared/time.ts";
import type { GitHubData } from "../../../../shared/types.ts";
import { GITHUB_OAUTH_CLIENT_ID } from "../../../config.ts";
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
        githubStartDeviceFlow: async () => {
            const clientId = GITHUB_OAUTH_CLIENT_ID;
            if (!clientId) {
                return {
                    success: false,
                    error: "GitHub OAuth client ID not configured",
                };
            }
            try {
                const res = await githubService.requestDeviceFlow(clientId);
                if (res.error) {
                    return {
                        success: false,
                        error: res.error_description || res.error,
                    };
                }
                return {
                    success: true,
                    userCode: res.user_code,
                    deviceCode: res.device_code,
                    verificationUri: res.verification_uri,
                    verificationUriComplete: res.verification_uri_complete,
                    interval: res.interval,
                    expiresIn: res.expires_in,
                };
            } catch (err: unknown) {
                return {
                    success: false,
                    error: toErrorMessage(err),
                };
            }
        },
        githubPollDeviceFlow: async ({
            deviceCode,
        }: {
            deviceCode: string;
        }) => {
            const clientId = GITHUB_OAUTH_CLIENT_ID;
            if (!clientId) {
                return {
                    success: false,
                    error: "Missing client ID",
                    retryable: false,
                };
            }
            return await githubService.pollDeviceFlow(clientId, deviceCode);
        },
        githubSignOut: async () => {
            await githubService.clearAuth();
            return { success: true };
        },
        getGitHubAuthStatus: async () => {
            return {
                authenticated: await githubService.isAuthenticated(),
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

                if (!(await githubService.isAuthenticated())) {
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
