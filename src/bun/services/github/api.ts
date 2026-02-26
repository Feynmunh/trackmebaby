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

export async function fetchGitHubIssuesAndPRs(
    token: string,
    owner: string,
    repo: string,
): Promise<{
    issuesData: GitHubSearchResponse | null;
    prsData: GitHubSearchResponse | null;
    issuesStatus: number;
    prsStatus: number;
}> {
    const headers = getGitHubHeaders(token);
    const [issuesRes, prsRes] = await Promise.all([
        fetch(
            `${GITHUB_API_BASE}/search/issues?q=repo:${owner}/${repo}+is:issue&sort=created&order=desc&per_page=50`,
            { headers },
        ),
        fetch(
            `${GITHUB_API_BASE}/search/issues?q=repo:${owner}/${repo}+is:pr&sort=created&order=desc&per_page=50`,
            { headers },
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
    };
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
