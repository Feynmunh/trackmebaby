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

const logger = createLogger("github");

const GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_API_BASE = "https://api.github.com";
const CALLBACK_PORT = 7890;
const CALLBACK_PATH = "/callback";

interface GitHubUserResponse {
    login?: string;
}

interface GitHubTokenResponse {
    access_token?: string;
    error?: string;
    error_description?: string;
}

interface GitHubSearchResponse {
    items?: GitHubSearchItem[];
}

interface GitHubSearchItem {
    number: number;
    title: string;
    state: "open" | "closed" | string;
    html_url: string;
    created_at: string;
    closed_at?: string | null;
    user?: { login?: string } | null;
    draft?: boolean;
    pull_request?: { merged_at?: string | null } | null;
}

function getGitHubHeaders(token: string): Record<string, string> {
    return {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
    };
}

/**
 * Parse a GitHub remote URL into owner/repo.
 * Supports SSH (git@github.com:owner/repo.git) and HTTPS (https://github.com/owner/repo.git)
 */
function parseGitHubRemoteUrl(
    remoteUrl: string,
): { owner: string; repo: string } | null {
    // SSH: git@github.com:owner/repo.git
    const sshMatch = remoteUrl.match(
        /github\.com[:/]([^/]+)\/([^/\s]+?)(?:\.git)?$/i,
    );
    if (sshMatch) {
        return { owner: sshMatch[1], repo: sshMatch[2] };
    }
    // HTTPS: https://github.com/owner/repo.git
    const httpsMatch = remoteUrl.match(
        /github\.com\/([^/]+)\/([^/\s]+?)(?:\.git)?$/i,
    );
    if (httpsMatch) {
        return { owner: httpsMatch[1], repo: httpsMatch[2] };
    }
    return null;
}

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
    private authServer: ReturnType<typeof Bun.serve> | null = null;
    private authTimeout: Timer | null = null;

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
    private async fetchUsername(token: string): Promise<string | null> {
        try {
            const res = await fetch(`${GITHUB_API_BASE}/user`, {
                headers: getGitHubHeaders(token),
            });
            if (!res.ok) {
                logger.error("failed to fetch user profile", {
                    status: res.status,
                    statusText: res.statusText,
                });
                return null;
            }
            const data = (await res.json()) as GitHubUserResponse;
            return data.login || null;
        } catch (err: unknown) {
            logger.error("error fetching username", {
                error: toErrorData(err),
            });
            return null;
        }
    }

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
            this.authServer = Bun.serve({
                port: CALLBACK_PORT,
                fetch: async (req) => {
                    const url = new URL(req.url);

                    if (url.pathname === CALLBACK_PATH) {
                        const code = url.searchParams.get("code");
                        const error = url.searchParams.get("error");

                        if (error || !code) {
                            this.scheduleCleanup();
                            return new Response(
                                getCallbackHtml(
                                    false,
                                    error || "No authorization code received",
                                ),
                                {
                                    headers: { "Content-Type": "text/html" },
                                },
                            );
                        }

                        // Exchange code for access token
                        try {
                            const tokenResponse = await fetch(
                                GITHUB_TOKEN_URL,
                                {
                                    method: "POST",
                                    headers: {
                                        "Content-Type": "application/json",
                                        Accept: "application/json",
                                    },
                                    body: JSON.stringify({
                                        client_id: clientId,
                                        client_secret: clientSecret,
                                        code,
                                    }),
                                },
                            );

                            const tokenData =
                                (await tokenResponse.json()) as GitHubTokenResponse;

                            if (tokenData.error || !tokenData.access_token) {
                                this.scheduleCleanup();
                                return new Response(
                                    getCallbackHtml(
                                        false,
                                        tokenData.error_description ||
                                            tokenData.error ||
                                            "Failed to exchange code",
                                    ),
                                    {
                                        headers: {
                                            "Content-Type": "text/html",
                                        },
                                    },
                                );
                            }

                            // Fetch username FIRST (before storing token, so polling doesn't see auth without username)
                            const username = await this.fetchUsername(
                                tokenData.access_token,
                            );

                            // Now store both atomically
                            this.setAccessToken(tokenData.access_token);
                            if (username) {
                                this.setUsername(username);
                            }

                            this.scheduleCleanup();
                            return new Response(
                                getCallbackHtml(
                                    true,
                                    undefined,
                                    username || undefined,
                                ),
                                {
                                    headers: { "Content-Type": "text/html" },
                                },
                            );
                        } catch (err: unknown) {
                            this.scheduleCleanup();
                            return new Response(
                                getCallbackHtml(false, toErrorMessage(err)),
                                {
                                    headers: { "Content-Type": "text/html" },
                                },
                            );
                        }
                    }

                    return new Response("Not found", { status: 404 });
                },
            });

            // Auto-cleanup after 120 seconds if no callback
            this.authTimeout = setTimeout(() => {
                this.cleanupAuthServer();
            }, 120000);

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

    private scheduleCleanup(): void {
        setTimeout(() => this.cleanupAuthServer(), 1000);
    }

    private cleanupAuthServer(): void {
        if (this.authTimeout) {
            clearTimeout(this.authTimeout);
            this.authTimeout = null;
        }
        if (this.authServer) {
            this.authServer.stop();
            this.authServer = null;
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

        const headers = getGitHubHeaders(token);

        try {
            // Fetch all issues and PRs - derive open counts from items to avoid extra API calls
            const [issuesRes, prsRes] = await Promise.all([
                fetch(
                    `${GITHUB_API_BASE}/search/issues?q=repo:${remote.owner}/${remote.repo}+is:issue&sort=created&order=desc&per_page=50`,
                    { headers },
                ),
                fetch(
                    `${GITHUB_API_BASE}/search/issues?q=repo:${remote.owner}/${remote.repo}+is:pr&sort=created&order=desc&per_page=50`,
                    { headers },
                ),
            ]);

            if (!issuesRes.ok || !prsRes.ok) {
                if ([issuesRes, prsRes].some((r) => r.status === 401)) {
                    this.clearAuth();
                }
                return null;
            }

            const issuesData = (await issuesRes.json()) as GitHubSearchResponse;
            const prsData = (await prsRes.json()) as GitHubSearchResponse;

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

/** Escape HTML special characters to prevent XSS in interpolated values */
function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/** Generate the HTML page shown after OAuth callback */
function getCallbackHtml(
    success: boolean,
    error?: string,
    username?: string,
): string {
    if (success) {
        return `<!DOCTYPE html>
<html>
<head>
    <title>Connected to GitHub</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
            display: flex; align-items: center; justify-content: center;
            min-height: 100vh; background: #0d1117; color: #f0f6fc;
        }
        .card {
            text-align: center; max-width: 420px; padding: 48px 40px;
            background: #161b22; border: 1px solid #30363d;
            border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        .check {
            width: 64px; height: 64px; margin: 0 auto 24px;
            background: rgba(46,160,67,0.15); border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
        }
        .check svg { width: 32px; height: 32px; color: #2ea043; }
        h1 { font-size: 22px; font-weight: 600; margin-bottom: 8px; color: #f0f6fc; }
        .username {
            display: inline-flex; align-items: center; gap: 8px;
            background: #21262d; border: 1px solid #30363d;
            border-radius: 8px; padding: 8px 16px; margin: 12px 0;
            font-size: 14px; font-weight: 500; color: #f0f6fc;
        }
        .username svg { width: 16px; height: 16px; color: #8b949e; }
        .hint {
            color: #8b949e; font-size: 13px; line-height: 1.5; margin-top: 16px;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="check">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" />
            </svg>
        </div>
        <h1>You're connected!</h1>
        ${
            username
                ? `<div class="username">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/>
            </svg>
            ${escapeHtml(username)}
        </div>`
                : ""
        }
        <p class="hint">You can close this tab and return to <strong>trackmebaby</strong>.</p>
    </div>
</body>
</html>`;
    }

    return `<!DOCTYPE html>
<html>
<head>
    <title>Authentication Failed</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
            display: flex; align-items: center; justify-content: center;
            min-height: 100vh; background: #0d1117; color: #f0f6fc;
        }
        .card {
            text-align: center; max-width: 420px; padding: 48px 40px;
            background: #161b22; border: 1px solid #30363d;
            border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        .icon {
            width: 64px; height: 64px; margin: 0 auto 24px;
            background: rgba(218,54,51,0.15); border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
        }
        .icon svg { width: 32px; height: 32px; color: #da3633; }
        h1 { font-size: 22px; font-weight: 600; margin-bottom: 8px; color: #f0f6fc; }
        .error { color: #da3633; font-size: 13px; margin-bottom: 16px; }
        .hint { color: #8b949e; font-size: 13px; line-height: 1.5; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
        </div>
        <h1>Something went wrong</h1>
        <p class="error">${escapeHtml(error || "Unknown error")}</p>
        <p class="hint">Please close this tab and try again in <strong>trackmebaby</strong>.</p>
    </div>
</body>
</html>`;
}
