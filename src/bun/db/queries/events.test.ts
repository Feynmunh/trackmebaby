import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { nowIso } from "../../../shared/time.ts";
import { runMigrations } from "../schema.ts";
import {
    getAllRecentEvents,
    getRecentEvents,
    hasEventsSince,
    insertEvent,
} from "./events.ts";

let db: Database;
let projectId: string;
let otherProjectId: string;

beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    projectId = Bun.randomUUIDv7();
    otherProjectId = Bun.randomUUIDv7();
    db.query(
        "INSERT INTO projects (id, path, name, created_at) VALUES (?, ?, ?, ?)",
    ).run(projectId, `/tmp/${projectId}`, "Events", nowIso());
    db.query(
        "INSERT INTO projects (id, path, name, created_at) VALUES (?, ?, ?, ?)",
    ).run(otherProjectId, `/tmp/${otherProjectId}`, "Other", nowIso());
});

describe("events queries", () => {
    test("insertEvent inserts and updates project last_activity_at", () => {
        const event = insertEvent(
            db,
            projectId,
            "file_modify",
            "src/main.ts",
            '{"delta":3}',
        );

        expect(event.projectId).toBe(projectId);
        expect(event.type).toBe("file_modify");
        expect(event.filePath).toBe("src/main.ts");
        expect(event.data).toBe('{"delta":3}');

        const project = db
            .query("SELECT last_activity_at FROM projects WHERE id = ?")
            .get(projectId) as { last_activity_at: string | null };
        expect(project.last_activity_at).toBe(event.timestamp);
    });

    test("getRecentEvents filters by project and since with limit", () => {
        const oldTs = "2025-01-01T00:00:00.000Z";
        const recentTs1 = "2026-01-02T00:00:00.000Z";
        const recentTs2 = "2026-01-03T00:00:00.000Z";

        db.query(
            "INSERT INTO events (id, project_id, timestamp, type, file_path, data) VALUES (?, ?, ?, ?, ?, ?)",
        ).run(
            Bun.randomUUIDv7(),
            projectId,
            oldTs,
            "file_create",
            "old.ts",
            null,
        );
        db.query(
            "INSERT INTO events (id, project_id, timestamp, type, file_path, data) VALUES (?, ?, ?, ?, ?, ?)",
        ).run(
            Bun.randomUUIDv7(),
            projectId,
            recentTs1,
            "file_modify",
            "a.ts",
            null,
        );
        db.query(
            "INSERT INTO events (id, project_id, timestamp, type, file_path, data) VALUES (?, ?, ?, ?, ?, ?)",
        ).run(
            Bun.randomUUIDv7(),
            projectId,
            recentTs2,
            "file_delete",
            "b.ts",
            null,
        );
        db.query(
            "INSERT INTO events (id, project_id, timestamp, type, file_path, data) VALUES (?, ?, ?, ?, ?, ?)",
        ).run(
            Bun.randomUUIDv7(),
            otherProjectId,
            recentTs2,
            "file_modify",
            "x.ts",
            null,
        );

        const rows = getRecentEvents(
            db,
            projectId,
            new Date("2026-01-01T00:00:00.000Z"),
            2,
        );
        expect(rows).toHaveLength(2);
        expect(rows.every((row) => row.projectId === projectId)).toBe(true);
        expect(rows.map((row) => row.filePath)).toEqual(["b.ts", "a.ts"]);
    });

    test("getAllRecentEvents returns cross-project events", () => {
        db.query(
            "INSERT INTO events (id, project_id, timestamp, type, file_path, data) VALUES (?, ?, ?, ?, ?, ?)",
        ).run(
            Bun.randomUUIDv7(),
            projectId,
            "2026-01-04T00:00:00.000Z",
            "file_modify",
            "a.ts",
            null,
        );
        db.query(
            "INSERT INTO events (id, project_id, timestamp, type, file_path, data) VALUES (?, ?, ?, ?, ?, ?)",
        ).run(
            Bun.randomUUIDv7(),
            otherProjectId,
            "2026-01-05T00:00:00.000Z",
            "file_modify",
            "b.ts",
            null,
        );

        const rows = getAllRecentEvents(
            db,
            new Date("2026-01-01T00:00:00.000Z"),
        );
        const ids = new Set(rows.map((row) => row.projectId));
        expect(ids.has(projectId)).toBe(true);
        expect(ids.has(otherProjectId)).toBe(true);
    });

    test("hasEventsSince uses strict greater-than boundary", () => {
        const exact = "2026-01-10T00:00:00.000Z";
        const later = "2026-01-10T00:00:01.000Z";

        db.query(
            "INSERT INTO events (id, project_id, timestamp, type, file_path, data) VALUES (?, ?, ?, ?, ?, ?)",
        ).run(
            Bun.randomUUIDv7(),
            projectId,
            exact,
            "file_create",
            "a.ts",
            null,
        );
        expect(hasEventsSince(db, projectId, new Date(exact))).toBe(false);

        db.query(
            "INSERT INTO events (id, project_id, timestamp, type, file_path, data) VALUES (?, ?, ?, ?, ?, ?)",
        ).run(
            Bun.randomUUIDv7(),
            projectId,
            later,
            "file_modify",
            "b.ts",
            null,
        );
        expect(hasEventsSince(db, projectId, new Date(exact))).toBe(true);
    });
});
