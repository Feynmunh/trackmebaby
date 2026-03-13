import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { nowIso } from "../../../shared/time.ts";
import type { Project, Worktree } from "../../../shared/types.ts";
import { runMigrations } from "../schema.ts";
import {
    deleteProject,
    getProjectByPath,
    getProjects,
    isProjectPathDeleted,
    mapProject,
    upsertProject,
} from "./projects.ts";

let db: Database;

beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
});

describe("projects queries", () => {
    test("upsertProject creates new project with defaults", () => {
        const project = upsertProject(db, "/tmp/p1", "P1");
        expect(project.path).toBe("/tmp/p1");
        expect(project.name).toBe("P1");
        expect(project.worktrees).toEqual([]);
        expect(project.lastActivityAt).toBeTruthy();
        expect(project.createdAt).toBeTruthy();
    });

    test("upsertProject updates existing name and worktrees", () => {
        upsertProject(db, "/tmp/p2", "Old Name");
        const worktrees: Worktree[] = [
            {
                path: "/tmp/p2",
                branch: "main",
                isMain: true,
                lastActivityAt: null,
                uncommittedCount: 0,
                uncommittedFiles: [],
            },
        ];

        const updated = upsertProject(
            db,
            "/tmp/p2",
            "New Name",
            "2026-01-01T00:00:00.000Z",
            worktrees,
        );
        expect(updated.name).toBe("New Name");
        expect(updated.worktrees).toEqual(worktrees);
        expect(updated.lastActivityAt).toBe("2026-01-01T00:00:00.000Z");
    });

    test("upsertProject returns existing project when no update is required", () => {
        const first = upsertProject(
            db,
            "/tmp/p3",
            "Stable",
            "2026-01-01T00:00:00.000Z",
        );
        const second = upsertProject(
            db,
            "/tmp/p3",
            "Stable",
            "2026-01-01T00:00:00.000Z",
        );
        expect(second.id).toBe(first.id);
    });

    test("getProjects orders by activity precedence and maps lastActivityAt", () => {
        const pEvent = upsertProject(
            db,
            "/tmp/event",
            "Event",
            "2026-01-01T00:00:00.000Z",
        );
        const pCommit = upsertProject(
            db,
            "/tmp/commit",
            "Commit",
            "2026-01-01T00:00:00.000Z",
        );
        const pOnlyActivity = upsertProject(
            db,
            "/tmp/activity",
            "Activity",
            "2026-01-03T00:00:00.000Z",
        );

        db.query(
            "INSERT INTO git_snapshots (id, project_id, timestamp, branch, last_commit_hash, last_commit_message, last_commit_timestamp, uncommitted_count, uncommitted_files, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ).run(
            Bun.randomUUIDv7(),
            pCommit.id,
            "2026-01-02T00:00:00.000Z",
            "main",
            "abc",
            "msg",
            "2026-01-04T00:00:00.000Z",
            0,
            "[]",
            null,
        );

        db.query(
            "INSERT INTO events (id, project_id, timestamp, type, file_path, data) VALUES (?, ?, ?, ?, ?, ?)",
        ).run(
            Bun.randomUUIDv7(),
            pEvent.id,
            "2026-01-05T00:00:00.000Z",
            "file_modify",
            "src/a.ts",
            null,
        );

        const projects = getProjects(db);
        expect(projects.map((project) => project.id)).toEqual([
            pEvent.id,
            pCommit.id,
            pOnlyActivity.id,
        ]);

        expect(projects[0].lastActivityAt).toBe("2026-01-05T00:00:00.000Z");
        expect(projects[1].lastActivityAt).toBe("2026-01-04T00:00:00.000Z");
        expect(projects[2].lastActivityAt).toBe("2026-01-03T00:00:00.000Z");
    });

    test("mapProject falls back to empty worktrees for malformed JSON", () => {
        const mapped: Project = mapProject({
            id: "id",
            path: "/tmp/x",
            name: "X",
            last_activity_at: "2026-01-01T00:00:00.000Z",
            created_at: "2026-01-01T00:00:00.000Z",
            worktrees: "{bad-json",
        });

        expect(mapped.worktrees).toEqual([]);
    });

    test("deleteProject removes related data and marks path as deleted", () => {
        const project = upsertProject(db, "/tmp/p4", "Delete Me");
        const projectId = project.id;

        db.query(
            "INSERT INTO project_caches (project_id, stats_json, stats_updated_at) VALUES (?, ?, ?)",
        ).run(projectId, "{}", nowIso());
        db.query(
            "INSERT INTO events (id, project_id, timestamp, type, file_path, data) VALUES (?, ?, ?, ?, ?, ?)",
        ).run(
            Bun.randomUUIDv7(),
            projectId,
            nowIso(),
            "file_create",
            "src/a.ts",
            null,
        );
        db.query(
            "INSERT INTO git_snapshots (id, project_id, timestamp, branch, last_commit_hash, last_commit_message, last_commit_timestamp, uncommitted_count, uncommitted_files, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ).run(
            Bun.randomUUIDv7(),
            projectId,
            nowIso(),
            "main",
            null,
            null,
            null,
            0,
            "[]",
            null,
        );

        expect(deleteProject(db, projectId)).toBe(true);
        expect(getProjectByPath(db, "/tmp/p4")).toBeNull();
        expect(isProjectPathDeleted(db, "/tmp/p4")).toBe(true);

        const eventCount = db
            .query("SELECT COUNT(*) as count FROM events WHERE project_id = ?")
            .get(projectId) as { count: number };
        const snapshotCount = db
            .query(
                "SELECT COUNT(*) as count FROM git_snapshots WHERE project_id = ?",
            )
            .get(projectId) as { count: number };
        const cacheCount = db
            .query(
                "SELECT COUNT(*) as count FROM project_caches WHERE project_id = ?",
            )
            .get(projectId) as { count: number };

        expect(eventCount.count).toBe(0);
        expect(snapshotCount.count).toBe(0);
        expect(cacheCount.count).toBe(0);
    });

    test("isProjectPathDeleted returns false for unknown path", () => {
        expect(isProjectPathDeleted(db, "/tmp/not-deleted")).toBe(false);
    });
});
