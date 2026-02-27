import type { Database } from "bun:sqlite";
import { safeJsonParse } from "../../../shared/error.ts";
import type {
    GitHubData,
    GitHubEtag,
    ProjectStats,
} from "../../../shared/types.ts";

export interface ProjectCacheRow {
    project_id: string;
    stats_json: string | null;
    stats_updated_at: string | null;
    github_json: string | null;
    github_etag: string | null;
    github_updated_at: string | null;
}

export interface ProjectStatsCache {
    stats: ProjectStats | null;
    updatedAt: string | null;
}

export interface GitHubCache {
    data: GitHubData | null;
    etag: GitHubEtag | null;
    updatedAt: string | null;
}

function getProjectCacheRow(
    db: Database,
    projectId: string,
): ProjectCacheRow | null {
    return db
        .query(
            "SELECT project_id, stats_json, stats_updated_at, github_json, github_etag, github_updated_at FROM project_caches WHERE project_id = ?",
        )
        .get(projectId) as ProjectCacheRow | null;
}

export function getProjectStatsCache(
    db: Database,
    projectId: string,
): ProjectStatsCache {
    const row = getProjectCacheRow(db, projectId);
    return {
        stats: safeJsonParse<ProjectStats | null>(
            row?.stats_json,
            null,
            "[DB] Failed to parse project stats cache JSON:",
        ),
        updatedAt: row?.stats_updated_at ?? null,
    };
}

export function setProjectStatsCache(
    db: Database,
    projectId: string,
    stats: ProjectStats | null,
    updatedAt: string,
): void {
    const json = stats ? JSON.stringify(stats) : null;
    db.query(
        "INSERT INTO project_caches (project_id, stats_json, stats_updated_at) VALUES (?, ?, ?) ON CONFLICT(project_id) DO UPDATE SET stats_json = excluded.stats_json, stats_updated_at = excluded.stats_updated_at",
    ).run(projectId, json, updatedAt);
}

export function getGitHubCache(db: Database, projectId: string): GitHubCache {
    const row = getProjectCacheRow(db, projectId);
    return {
        data: safeJsonParse<GitHubData | null>(
            row?.github_json,
            null,
            "[DB] Failed to parse GitHub cache JSON:",
        ),
        etag: safeJsonParse<GitHubEtag | null>(
            row?.github_etag,
            null,
            "[DB] Failed to parse GitHub etag JSON:",
        ),
        updatedAt: row?.github_updated_at ?? null,
    };
}

export function setGitHubCache(
    db: Database,
    projectId: string,
    data: GitHubData | null,
    etag: GitHubEtag | null,
    updatedAt: string,
): void {
    const json = data ? JSON.stringify(data) : null;
    const etagJson = etag ? JSON.stringify(etag) : null;
    db.query(
        "INSERT INTO project_caches (project_id, github_json, github_etag, github_updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(project_id) DO UPDATE SET github_json = excluded.github_json, github_etag = excluded.github_etag, github_updated_at = excluded.github_updated_at",
    ).run(projectId, json, etagJson, updatedAt);
}
