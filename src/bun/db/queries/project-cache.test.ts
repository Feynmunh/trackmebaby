import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { nowIso } from "../../../shared/time.ts";
import type {
    GitHubData,
    GitHubEtag,
    ProjectStats,
} from "../../../shared/types.ts";
import { runMigrations } from "../schema.ts";
import {
    getGitHubCache,
    getProjectStatsCache,
    setGitHubCache,
    setProjectStatsCache,
} from "./project-cache.ts";

let db: Database;
let projectId: string;

beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    projectId = Bun.randomUUIDv7();
    db.query(
        "INSERT INTO projects (id, path, name, created_at) VALUES (?, ?, ?, ?)",
    ).run(projectId, `/tmp/${projectId}`, "Cache Test", nowIso());
});

describe("project-cache queries", () => {
    test("returns null caches for missing rows", () => {
        expect(getProjectStatsCache(db, projectId)).toEqual({
            stats: null,
            updatedAt: null,
        });
        expect(getGitHubCache(db, projectId)).toEqual({
            data: null,
            etag: null,
            updatedAt: null,
        });
    });

    test("setProjectStatsCache and getProjectStatsCache round-trip", () => {
        const stats: ProjectStats = {
            branchCount: 2,
            branches: ["main", "dev"],
            totalCommits: 30,
            repoAgeFirstCommit: "2026-01-01T00:00:00.000Z",
            recentCommits: [],
            diffSummary: { filesChanged: 3, insertions: 10, deletions: 2 },
        };

        setProjectStatsCache(db, projectId, stats, "2026-01-10T00:00:00.000Z");
        expect(getProjectStatsCache(db, projectId)).toEqual({
            stats,
            updatedAt: "2026-01-10T00:00:00.000Z",
        });
    });

    test("setProjectStatsCache supports null stats and updates existing row", () => {
        setProjectStatsCache(db, projectId, null, "2026-01-11T00:00:00.000Z");
        expect(getProjectStatsCache(db, projectId)).toEqual({
            stats: null,
            updatedAt: "2026-01-11T00:00:00.000Z",
        });

        const nextStats: ProjectStats = {
            branchCount: 1,
            branches: ["main"],
            totalCommits: 1,
            repoAgeFirstCommit: null,
            recentCommits: [],
            diffSummary: null,
        };
        setProjectStatsCache(
            db,
            projectId,
            nextStats,
            "2026-01-12T00:00:00.000Z",
        );
        expect(getProjectStatsCache(db, projectId)).toEqual({
            stats: nextStats,
            updatedAt: "2026-01-12T00:00:00.000Z",
        });
    });

    test("setGitHubCache and getGitHubCache round-trip", () => {
        const data: GitHubData = {
            openIssues: 4,
            openPRs: 2,
            contributorCount: 5,
            repoUrl: "https://github.com/acme/repo",
            issues: [],
            pullRequests: [],
        };
        const etag: GitHubEtag = { issues: "etag-issues", prs: "etag-prs" };

        setGitHubCache(db, projectId, data, etag, "2026-01-20T00:00:00.000Z");
        expect(getGitHubCache(db, projectId)).toEqual({
            data,
            etag,
            updatedAt: "2026-01-20T00:00:00.000Z",
        });
    });

    test("getters fall back on malformed JSON", () => {
        db.query(
            "INSERT INTO project_caches (project_id, stats_json, stats_updated_at, github_json, github_etag, github_updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        ).run(
            projectId,
            "{bad-json",
            "2026-01-01T00:00:00.000Z",
            "{bad-json",
            "{bad-json",
            "2026-01-01T00:00:00.000Z",
        );

        expect(getProjectStatsCache(db, projectId)).toEqual({
            stats: null,
            updatedAt: "2026-01-01T00:00:00.000Z",
        });
        expect(getGitHubCache(db, projectId)).toEqual({
            data: null,
            etag: null,
            updatedAt: "2026-01-01T00:00:00.000Z",
        });
    });
});
