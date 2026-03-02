/**
 * Tests for database module: schema, CRUD, UUIDv7 ordering
 */

import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import {
    getActivitySummary,
    getLatestGitSnapshot,
    getProjectById,
    getProjectByPath,
    getProjects,
    getRecentEvents,
    getSetting,
    insertEvent,
    insertGitSnapshot,
    setSetting,
    upsertProject,
} from "./queries.ts";
import { runMigrations } from "./schema.ts";

let db: Database;

beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
});

describe("Schema", () => {
    test("creates all required tables", () => {
        const tables = db
            .query(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
            )
            .all() as { name: string }[];
        const names = tables.map((t) => t.name);

        expect(names).toContain("projects");
        expect(names).toContain("events");
        expect(names).toContain("git_snapshots");
        expect(names).toContain("settings");
        expect(names).toContain("schema_version");
        expect(names).toContain("warden_insights");
    });

    test("sets schema version", () => {
        const row = db
            .query("SELECT MAX(version) as v FROM schema_version")
            .get() as { v: number };
        expect(row.v).toBe(4);
    });
});

describe("Projects", () => {
    test("upsert creates a new project", () => {
        const project = upsertProject(db, "/tmp/test", "test");
        expect(project.id).toBeTruthy();
        expect(project.path).toBe("/tmp/test");
        expect(project.name).toBe("test");
        expect(project.createdAt).toBeTruthy();
    });

    test("upsert updates existing project", () => {
        upsertProject(db, "/tmp/test", "test-old");
        upsertProject(db, "/tmp/test", "test-new");
        const all = getProjects(db);
        expect(all.length).toBe(1);
        expect(all[0].name).toBe("test-new");
    });

    test("getProjects returns all projects", () => {
        upsertProject(db, "/tmp/a", "a");
        upsertProject(db, "/tmp/b", "b");
        const projects = getProjects(db);
        expect(projects.length).toBe(2);
    });

    test("getProjectById and getProjectByPath work", () => {
        const p = upsertProject(db, "/tmp/test", "test");
        expect(getProjectById(db, p.id)).toBeTruthy();
        expect(getProjectByPath(db, "/tmp/test")).toBeTruthy();
        expect(getProjectById(db, "nonexistent")).toBeNull();
        expect(getProjectByPath(db, "/nonexistent")).toBeNull();
    });
});

describe("Events", () => {
    test("insertEvent creates with UUIDv7", () => {
        const p = upsertProject(db, "/tmp/test", "test");
        const e = insertEvent(db, p.id, "file_create", "src/index.ts");
        expect(e.id).toBeTruthy();
        expect(e.type).toBe("file_create");
        expect(e.filePath).toBe("src/index.ts");
    });

    test("events are ordered by id DESC (newest first)", () => {
        const p = upsertProject(db, "/tmp/test", "test");
        insertEvent(db, p.id, "file_create", "a.ts");
        insertEvent(db, p.id, "file_modify", "b.ts");
        insertEvent(db, p.id, "file_delete", "c.ts");

        const events = getRecentEvents(db, p.id, new Date(0));
        expect(events.length).toBe(3);
        // DESC order: newest first
        expect(events[0].id > events[1].id).toBe(true);
        expect(events[1].id > events[2].id).toBe(true);
    });

    test("getRecentEvents filters by since date", () => {
        const p = upsertProject(db, "/tmp/test", "test");
        insertEvent(db, p.id, "file_create", "old.ts");

        // Events from "now" should include the one we just inserted
        const events = getRecentEvents(db, p.id, new Date(0));
        expect(events.length).toBe(1);

        // Events from far future should be empty
        const futureDate = new Date("2099-01-01");
        const noEvents = getRecentEvents(db, p.id, futureDate);
        expect(noEvents.length).toBe(0);
    });
});

describe("Git Snapshots", () => {
    test("insertGitSnapshot creates with UUIDv7", () => {
        const p = upsertProject(db, "/tmp/test", "test");
        const s = insertGitSnapshot(
            db,
            p.id,
            "main",
            "abc123",
            "initial",
            "2024-01-01",
            2,
            ["a.ts", "b.ts"],
        );
        expect(s.id).toBeTruthy();
        expect(s.branch).toBe("main");
        expect(s.uncommittedCount).toBe(2);
        expect(s.uncommittedFiles).toEqual(["a.ts", "b.ts"]);
    });

    test("getLatestGitSnapshot returns most recent", () => {
        const p = upsertProject(db, "/tmp/test", "test");
        insertGitSnapshot(db, p.id, "main", "aaa", "first", null, 0, []);
        insertGitSnapshot(db, p.id, "dev", "bbb", "second", null, 1, ["x.ts"]);

        const latest = getLatestGitSnapshot(db, p.id);
        expect(latest).toBeTruthy();
        expect(latest!.branch).toBe("dev");
        expect(latest!.lastCommitMessage).toBe("second");
    });

    test("getLatestGitSnapshot returns null for unknown project", () => {
        expect(getLatestGitSnapshot(db, "nonexistent")).toBeNull();
    });
});

describe("Settings", () => {
    test("getSetting returns null for missing key", () => {
        expect(getSetting(db, "nonexistent")).toBeNull();
    });

    test("setSetting and getSetting round-trip", () => {
        setSetting(db, "basePath", "/home/user/projects");
        expect(getSetting(db, "basePath")).toBe("/home/user/projects");
    });

    test("setSetting overwrites existing", () => {
        setSetting(db, "key", "old");
        setSetting(db, "key", "new");
        expect(getSetting(db, "key")).toBe("new");
    });
});

describe("Activity Summary", () => {
    test("getActivitySummary groups by date", () => {
        const p = upsertProject(db, "/tmp/test", "test");
        insertEvent(db, p.id, "file_create", "a.ts");
        insertEvent(db, p.id, "file_modify", "b.ts");
        insertEvent(db, p.id, "file_delete", "c.ts");

        const summary = getActivitySummary(db, p.id, new Date(0), new Date());
        expect(summary.length).toBe(1);
        expect(summary[0].fileCreates).toBe(1);
        expect(summary[0].fileModifies).toBe(1);
        expect(summary[0].fileDeletes).toBe(1);
        expect(summary[0].total).toBe(3);
    });
});
