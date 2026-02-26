/**
 * GitHub Service — OAuth flow and GitHub API integration
 * Handles localhost-redirect OAuth, token storage, and issues/PRs fetching
 */

import type { Database } from "bun:sqlite";
import { toErrorData, toErrorMessage } from "../../shared/error.ts";
import { createLogger } from "../../shared/logger.ts";
import type { GitHubData, GitHubIssue, GitHubPR } from "../../shared/types.ts";
import { getSetting, setSetting } from "../db/queries.ts";
import { runGit } from "./git-command.ts";
import type { GitHubSearchItem } from "./github/api.ts";
import {
    fetchGitHubIssuesAndPRs,
    fetchGitHubUser,
    parseGitHubRemoteUrl,
} from "./github/api.ts";
import {
    CALLBACK_PATH,
    CALLBACK_PORT,
    GITHUB_AUTH_URL,
    startOAuthServer,
} from "./github/oauth.ts";

const logger = createLogger("github");

/**
 * Get the GitHub remote URL from a project's git config.
 */
async function getGitHubRemote(
    projectPath: string,
): Promise<{ owner: string; repo: string } | null> {
    try {
        const url = await runGit(["remote", "get-url", "origin"], {
            projectPath,
            label: "GitHub",
        });
        if (!url) return null;
        return parseGitHubRemoteUrl(url);
    } catch (err: unknown) {
        logger.warn("failed to read remote", {
            projectPath,
            error: toErrorData(err),
        });
        return null;
    }
}

export class GitHubService {
    private db: Database;
    private authCleanup: (() => void) | null = null;

    constructor(db: Database) {
        this.db = db;
    }

    /** Get the stored GitHub access token, or null if not authenticated. */
    getAccessToken(): string | null {
        return getSetting(this.db, "githubAccessToken");
    }

    /** Get the stored GitHub username, or null. */
    getUsername(): string | null {
        return getSetting(this.db, "githubUsername");
    }

    /** Check if user is authenticated with GitHub. */
    isAuthenticated(): boolean {
        return !!this.getAccessToken();
    }

    /** Store a GitHub access token. */
    private setAccessToken(token: string): void {
        setSetting(this.db, "githubAccessToken", token);
    }

    /** Store the GitHub username. */
    private setUsername(username: string): void {
        setSetting(this.db, "githubUsername", username);
    }

    /** Remove the stored GitHub access token and username. */
    clearAuth(): void {
        try {
            this.db
                .query("DELETE FROM settings WHERE key = ?")
                .run("githubAccessToken");
            this.db
                .query("DELETE FROM settings WHERE key = ?")
                .run("githubUsername");
        } catch (err: unknown) {
            logger.warn("failed to clear auth", { error: toErrorData(err) });
        }
    }

    /**
     * Fetch the authenticated user's profile to get their username.
     */
    /**
     * Start the GitHub OAuth flow (NON-BLOCKING).
     * 1. Starts a temporary HTTP server on localhost:7890
     * 2. Opens the GitHub authorization URL in the system browser
     * 3. Returns immediately — the server handles the callback in the background
     * 4. On callback: exchanges code for token, fetches username, stores both, shuts down server
     */
    startOAuthFlow(
        clientId: string,
        clientSecret: string,
    ): { success: boolean; error?: string } {
        // Clean up any existing auth server
        this.cleanupAuthServer();

        try {
            const { cleanup } = startOAuthServer(
                clientId,
                clientSecret,
                async (token) => {
                    const username = await fetchGitHubUser(token);
                    this.setAccessToken(token);
                    if (username) {
                        this.setUsername(username);
                    }
                    return username;
                },
            );
            this.authCleanup = cleanup;

            // Build the authorization URL
            const authUrl = new URL(GITHUB_AUTH_URL);
            authUrl.searchParams.set("client_id", clientId);
            authUrl.searchParams.set(
                "redirect_uri",
                `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`,
            );
            authUrl.searchParams.set("scope", "repo");
            authUrl.searchParams.set("state", crypto.randomUUID());

            // Open the browser
            const openCmd =
                process.platform === "darwin"
                    ? "open"
                    : process.platform === "win32"
                      ? "start"
                      : "xdg-open";
            Bun.spawn([openCmd, authUrl.toString()], {
                detached: true,
                stdio: ["ignore", "ignore", "ignore"],
            }).unref();

            return { success: true };
        } catch (err: unknown) {
            this.cleanupAuthServer();
            logger.error("failed to start oauth server", {
                error: toErrorData(err),
            });
            return {
                success: false,
                error: `Failed to start OAuth server: ${toErrorMessage(err)}`,
            };
        }
    }

    private cleanupAuthServer(): void {
        if (this.authCleanup) {
            this.authCleanup();
            this.authCleanup = null;
        }
    }

    /**
     * Fetch GitHub issues and PRs for a project.
     * Uses the git remote URL to determine the repository.
     */
    async getGitHubData(projectPath: string): Promise<GitHubData | null> {
        const token = this.getAccessToken();
        if (!token) return null;

        const remote = await getGitHubRemote(projectPath);
        if (!remote) return null;

        try {
            const { issuesData, prsData, issuesStatus, prsStatus } =
                await fetchGitHubIssuesAndPRs(token, remote.owner, remote.repo);

            if (!issuesData || !prsData) {
                if (issuesStatus === 401 || prsStatus === 401) {
                    this.clearAuth();
                }
                return null;
            }

            // Derive open counts from items we already fetched
            const allIssues = issuesData.items || [];
            const allPRs = prsData.items || [];
            const openIssues = allIssues.filter(
                (i) => i.state === "open",
            ).length;
            const openPRs = allPRs.filter((i) => i.state === "open").length;

            const mapIssue = (i: GitHubSearchItem): GitHubIssue => ({
                number: i.number,
                title: i.title,
                state:
                    i.state === "open" || i.state === "closed"
                        ? i.state
                        : "open",
                url: i.html_url,
                createdAt: i.created_at,
                user: i.user?.login || "unknown",
                closedAt: i.closed_at ?? null,
            });

            const mapPr = (i: GitHubSearchItem): GitHubPR => ({
                number: i.number,
                title: i.title,
                state:
                    i.state === "open" || i.state === "closed"
                        ? i.state
                        : "open",
                url: i.html_url,
                createdAt: i.created_at,
                user: i.user?.login || "unknown",
                draft: i.draft || false,
                closedAt: i.closed_at ?? null,
                mergedAt: i.pull_request?.merged_at ?? null,
            });

            return {
                openIssues,
                openPRs,
                repoUrl: `https://github.com/${remote.owner}/${remote.repo}`,
                issues: allIssues.map(mapIssue),
                pullRequests: allPRs.map(mapPr),
            };
        } catch (err: unknown) {
            logger.error("error fetching data", {
                repo: `${remote.owner}/${remote.repo}`,
                error: toErrorData(err),
            });
            return null;
        }
    }
}
