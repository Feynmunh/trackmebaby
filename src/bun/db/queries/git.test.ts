import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { nowIso } from "../../../shared/time.ts";
import { runMigrations } from "../schema.ts";
import {
    getGitSnapshots,
    getLatestGitSnapshot,
    hasGitSnapshots,
    insertGitSnapshot,
} from "./git.ts";

let db: Database;
let projectId: string;

beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    projectId = Bun.randomUUIDv7();
    db.query(
        "INSERT INTO projects (id, path, name, created_at) VALUES (?, ?, ?, ?)",
    ).run(projectId, `/tmp/${projectId}`, "Git", nowIso());
});

describe("git queries", () => {
    test("insertGitSnapshot stores fields and returns created snapshot", () => {
        const snapshot = insertGitSnapshot(
            db,
            projectId,
            "main",
            "abc123",
            "feat: add tests",
            "2026-01-01T00:00:00.000Z",
            2,
            ["a.ts", "b.ts"],
            '{"filesChanged":2}',
        );

        expect(snapshot.projectId).toBe(projectId);
        expect(snapshot.branch).toBe("main");
        expect(snapshot.uncommittedFiles).toEqual(["a.ts", "b.ts"]);
        expect(snapshot.data).toBe('{"filesChanged":2}');
    });

    test("getLatestGitSnapshot returns newest snapshot or null", async () => {
        expect(getLatestGitSnapshot(db, projectId)).toBeNull();

        insertGitSnapshot(
            db,
            projectId,
            "main",
            "a",
            "one",
            "2026-01-01T00:00:00.000Z",
            0,
            [],
        );
        await Bun.sleep(25);
        const newest = insertGitSnapshot(
            db,
            projectId,
            "dev",
            "b",
            "two",
            "2026-01-02T00:00:00.000Z",
            1,
            ["x.ts"],
        );

        const latest = getLatestGitSnapshot(db, projectId);
        expect(latest?.id).toBe(newest.id);
        expect(latest?.branch).toBe("dev");
    });

    test("getGitSnapshots filters by since and limit", () => {
        db.query(
            "INSERT INTO git_snapshots (id, project_id, timestamp, branch, last_commit_hash, last_commit_message, last_commit_timestamp, uncommitted_count, uncommitted_files, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ).run(
            Bun.randomUUIDv7(),
            projectId,
            "2025-01-01T00:00:00.000Z",
            "main",
            null,
            null,
            null,
            0,
            "[]",
            null,
        );
        db.query(
            "INSERT INTO git_snapshots (id, project_id, timestamp, branch, last_commit_hash, last_commit_message, last_commit_timestamp, uncommitted_count, uncommitted_files, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ).run(
            Bun.randomUUIDv7(),
            projectId,
            "2026-01-02T00:00:00.000Z",
            "main",
            null,
            null,
            null,
            1,
            "[]",
            null,
        );
        db.query(
            "INSERT INTO git_snapshots (id, project_id, timestamp, branch, last_commit_hash, last_commit_message, last_commit_timestamp, uncommitted_count, uncommitted_files, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ).run(
            Bun.randomUUIDv7(),
            projectId,
            "2026-01-03T00:00:00.000Z",
            "dev",
            null,
            null,
            null,
            2,
            "[]",
            null,
        );

        const rows = getGitSnapshots(
            db,
            projectId,
            new Date("2026-01-01T00:00:00.000Z"),
            1,
        );
        expect(rows).toHaveLength(1);
        expect(rows[0].branch).toBe("dev");
    });

    test("hasGitSnapshots checks project snapshot presence", () => {
        expect(hasGitSnapshots(db, projectId)).toBe(false);
        insertGitSnapshot(db, projectId, "main", null, null, null, 0, []);
        expect(hasGitSnapshots(db, projectId)).toBe(true);
    });

    test("snapshot mapping falls back for malformed uncommitted_files JSON", () => {
        const id = Bun.randomUUIDv7();
        db.query(
            "INSERT INTO git_snapshots (id, project_id, timestamp, branch, last_commit_hash, last_commit_message, last_commit_timestamp, uncommitted_count, uncommitted_files, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ).run(
            id,
            projectId,
            "2026-01-03T00:00:00.000Z",
            "main",
            null,
            null,
            null,
            0,
            "{bad-json",
            null,
        );

        const latest = getLatestGitSnapshot(db, projectId);
        expect(latest?.id).toBe(id);
        expect(latest?.uncommittedFiles).toEqual([]);
    });
});
