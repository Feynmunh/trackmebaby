import type { Database } from "bun:sqlite";
import { nowIso } from "../../../shared/time.ts";
import type { ActivityEvent } from "../../../shared/types.ts";

export interface EventRow {
    id: string;
    project_id: string;
    timestamp: string;
    type: "file_create" | "file_modify" | "file_delete";
    file_path: string;
    data?: string | null;
}

export function insertEvent(
    db: Database,
    projectId: string,
    type: "file_create" | "file_modify" | "file_delete",
    filePath: string,
    data?: string,
): ActivityEvent {
    const id = Bun.randomUUIDv7();
    const timestamp = nowIso();

    db.query(
        "INSERT INTO events (id, project_id, timestamp, type, file_path, data) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(id, projectId, timestamp, type, filePath, data ?? null);

    db.query("UPDATE projects SET last_activity_at = ? WHERE id = ?").run(
        timestamp,
        projectId,
    );

    return { id, projectId, timestamp, type, filePath, data };
}

export function getRecentEvents(
    db: Database,
    projectId: string,
    since: Date,
    limit: number = 100,
): ActivityEvent[] {
    const rows = db
        .query(
            "SELECT * FROM events WHERE project_id = ? AND timestamp >= ? ORDER BY id DESC LIMIT ?",
        )
        .all(projectId, since.toISOString(), limit) as EventRow[];

    return rows.map(mapEvent);
}

export function getAllRecentEvents(
    db: Database,
    since: Date,
    limit: number = 500,
): ActivityEvent[] {
    const rows = db
        .query(
            "SELECT * FROM events WHERE timestamp >= ? ORDER BY id DESC LIMIT ?",
        )
        .all(since.toISOString(), limit) as EventRow[];

    return rows.map(mapEvent);
}

export function mapEvent(row: EventRow): ActivityEvent {
    return {
        id: row.id,
        projectId: row.project_id,
        timestamp: row.timestamp,
        type: row.type,
        filePath: row.file_path,
        data: row.data ?? undefined,
    };
}

export function hasEventsSince(
    db: Database,
    projectId: string,
    since: Date,
): boolean {
    const result = db
        .query(
            "SELECT 1 FROM events WHERE project_id = ? AND timestamp > ? LIMIT 1",
        )
        .get(projectId, since.toISOString());
    return result !== null;
}
