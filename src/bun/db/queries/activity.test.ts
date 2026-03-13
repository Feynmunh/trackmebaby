import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { nowIso } from "../../../shared/time.ts";
import { runMigrations } from "../schema.ts";
import { getActivitySummary } from "./activity.ts";

let db: Database;
let projectId: string;

beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    projectId = Bun.randomUUIDv7();
    db.query(
        "INSERT INTO projects (id, path, name, created_at) VALUES (?, ?, ?, ?)",
    ).run(projectId, `/tmp/${projectId}`, "Activity", nowIso());
});

describe("activity queries", () => {
    test("getActivitySummary groups by date and counts event types", () => {
        const createTs = "2026-01-02T10:00:00.000Z";
        const modifyTs = "2026-01-02T11:00:00.000Z";
        const deleteTs = "2026-01-01T09:00:00.000Z";

        db.query(
            "INSERT INTO events (id, project_id, timestamp, type, file_path, data) VALUES (?, ?, ?, ?, ?, ?)",
        ).run(
            Bun.randomUUIDv7(),
            projectId,
            createTs,
            "file_create",
            "a.ts",
            null,
        );
        db.query(
            "INSERT INTO events (id, project_id, timestamp, type, file_path, data) VALUES (?, ?, ?, ?, ?, ?)",
        ).run(
            Bun.randomUUIDv7(),
            projectId,
            modifyTs,
            "file_modify",
            "b.ts",
            null,
        );
        db.query(
            "INSERT INTO events (id, project_id, timestamp, type, file_path, data) VALUES (?, ?, ?, ?, ?, ?)",
        ).run(
            Bun.randomUUIDv7(),
            projectId,
            deleteTs,
            "file_delete",
            "c.ts",
            null,
        );

        const summary = getActivitySummary(
            db,
            projectId,
            new Date("2026-01-01T00:00:00.000Z"),
            new Date("2026-01-03T00:00:00.000Z"),
        );

        expect(summary).toHaveLength(2);
        const createDate = (
            db.query("SELECT DATE(?, 'localtime') as date").get(createTs) as {
                date: string;
            }
        ).date;
        const deleteDate = (
            db.query("SELECT DATE(?, 'localtime') as date").get(deleteTs) as {
                date: string;
            }
        ).date;

        const byDate = new Map(summary.map((row) => [row.date, row]));
        expect(byDate.get(createDate)).toEqual({
            date: createDate,
            fileCreates: 1,
            fileModifies: 1,
            fileDeletes: 0,
            total: 2,
        });
        expect(byDate.get(deleteDate)).toEqual({
            date: deleteDate,
            fileCreates: 0,
            fileModifies: 0,
            fileDeletes: 1,
            total: 1,
        });
    });

    test("getActivitySummary returns empty array when no events are in range", () => {
        const summary = getActivitySummary(
            db,
            projectId,
            new Date("2026-01-01T00:00:00.000Z"),
            new Date("2026-01-02T00:00:00.000Z"),
        );
        expect(summary).toEqual([]);
    });
});
