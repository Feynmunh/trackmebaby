import { toErrorData } from "../../../shared/error.ts";
import { createLogger } from "../../../shared/logger.ts";

const logger = createLogger("github");

export const GITHUB_API_BASE = "https://api.github.com";

export interface GitHubUserResponse {
    login?: string;
}

export interface GitHubTokenResponse {
    access_token?: string;
    error?: string;
    error_description?: string;
}

export interface GitHubSearchResponse {
    items?: GitHubSearchItem[];
}

export interface GitHubSearchItem {
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

export function getGitHubHeaders(token: string): Record<string, string> {
    return {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
    };
}

export async function fetchGitHubUser(token: string): Promise<string | null> {
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

export interface GitHubFetchResult {
    issuesData: GitHubSearchResponse | null;
    prsData: GitHubSearchResponse | null;
    issuesStatus: number;
    prsStatus: number;
    issuesEtag: string | null;
    prsEtag: string | null;
}

export async function fetchGitHubIssuesAndPRs(
    token: string,
    owner: string,
    repo: string,
    options: {
        etag?: { issues?: string | null; prs?: string | null };
        timeoutMs?: number;
    } = {},
): Promise<GitHubFetchResult> {
    const timeoutMs = options.timeoutMs ?? 8000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const issuesHeaders = getGitHubHeaders(token);
        const prsHeaders = getGitHubHeaders(token);
        if (options.etag?.issues) {
            issuesHeaders["If-None-Match"] = options.etag.issues;
        }
        if (options.etag?.prs) {
            prsHeaders["If-None-Match"] = options.etag.prs;
        }
        const [issuesRes, prsRes] = await Promise.all([
            fetch(
                `${GITHUB_API_BASE}/search/issues?q=repo:${owner}/${repo}+is:issue&sort=created&order=desc&per_page=100`,
                { headers: issuesHeaders, signal: controller.signal },
            ),
            fetch(
                `${GITHUB_API_BASE}/search/issues?q=repo:${owner}/${repo}+is:pr&sort=created&order=desc&per_page=100`,
                { headers: prsHeaders, signal: controller.signal },
            ),
        ]);

        const issuesData = issuesRes.ok
            ? ((await issuesRes.json()) as GitHubSearchResponse)
            : null;
        const prsData = prsRes.ok
            ? ((await prsRes.json()) as GitHubSearchResponse)
            : null;

        return {
            issuesData,
            prsData,
            issuesStatus: issuesRes.status,
            prsStatus: prsRes.status,
            issuesEtag: issuesRes.headers.get("etag"),
            prsEtag: prsRes.headers.get("etag"),
        };
    } finally {
        clearTimeout(timeoutId);
    }
}

export async function fetchGitHubContributorCount(
    token: string,
    owner: string,
    repo: string,
    retries = 5,
): Promise<number> {
    try {
        // Use the stats/contributors endpoint which matches the GitHub UI "Contributors" tab.
        // This endpoint often returns 202 Accepted while calculating.
        const res = await fetch(
            `${GITHUB_API_BASE}/repos/${owner}/${repo}/stats/contributors`,
            { headers: getGitHubHeaders(token) },
        );

        // GitHub may return 202 Accepted if it's still calculating.
        if (res.status === 202 && retries > 0) {
            // Stats API can be slow, especially for new requests.
            // Exponential backoff could be better, but we'll stick to a steady wait for now.
            await new Promise((resolve) => setTimeout(resolve, 4000));
            return fetchGitHubContributorCount(token, owner, repo, retries - 1);
        }

        if (res.ok && res.status !== 204) {
            const data = await res.json();
            if (Array.isArray(data)) {
                return data.length;
            }
        }

        // Fallback: Use the contributors API with anon=true.
        // This is fast and usually accurate for matching the UI count.
        const backupRes = await fetch(
            `${GITHUB_API_BASE}/repos/${owner}/${repo}/contributors?per_page=1&anon=true`,
            { headers: getGitHubHeaders(token) },
        );

        if (backupRes.ok) {
            const linkHeader = backupRes.headers.get("Link");
            if (linkHeader) {
                const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
                if (lastMatch) {
                    return parseInt(lastMatch[1], 10);
                }
            }

            // If no link header but ok, it might be 1 or 0 contributors.
            const backupData = await backupRes.json();
            if (Array.isArray(backupData) && backupData.length > 0) {
                return backupData.length;
            }
        }

        // Final Bulletproof Fallback: Fetch the last 100 commits and count unique authors.
        // This is necessary because GitHub's contributors endpoints can be very slow to update
        // or might exclude some contributors for various reasons.
        const commitRes = await fetch(
            `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?per_page=100`,
            { headers: getGitHubHeaders(token) },
        );
        if (commitRes.ok) {
            const commits = await commitRes.json();
            if (Array.isArray(commits)) {
                const authors = new Set(
                    commits
                        .map((c) => c.author?.login || c.commit?.author?.email)
                        .filter(Boolean),
                );
                return authors.size;
            }
        }

        return 0;
    } catch (err: unknown) {
        logger.error("error fetching contributor count", {
            repo: `${owner}/${repo}`,
            error: toErrorData(err),
        });
        return 0;
    }
}

/**
 * Parse a GitHub remote URL into owner/repo.
 * Supports SSH (git@github.com:owner/repo.git) and HTTPS (https://github.com/owner/repo.git)
 */
export function parseGitHubRemoteUrl(
    remoteUrl: string,
): { owner: string; repo: string } | null {
    const sshMatch = remoteUrl.match(
        /github\.com[:/]([^/]+)\/([^/\s]+?)(?:\.git)?$/i,
    );
    if (sshMatch) {
        return { owner: sshMatch[1], repo: sshMatch[2] };
    }
    const httpsMatch = remoteUrl.match(
        /github\.com\/([^/]+)\/([^/\s]+?)(?:\.git)?$/i,
    );
    if (httpsMatch) {
        return { owner: httpsMatch[1], repo: httpsMatch[2] };
    }
    return null;
}
