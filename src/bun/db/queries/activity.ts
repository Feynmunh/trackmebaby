import type { Database } from "bun:sqlite";
import type { ActivitySummary } from "../../../shared/types.ts";

export function getActivitySummary(
    db: Database,
    projectId: string,
    since: Date,
    until: Date,
): ActivitySummary[] {
    const rows = db
        .query(`
    SELECT
      DATE(timestamp, 'localtime') as date,
      SUM(CASE WHEN type = 'file_create' THEN 1 ELSE 0 END) as file_creates,
      SUM(CASE WHEN type = 'file_modify' THEN 1 ELSE 0 END) as file_modifies,
      SUM(CASE WHEN type = 'file_delete' THEN 1 ELSE 0 END) as file_deletes,
      COUNT(*) as total
    FROM events
    WHERE project_id = ? AND timestamp >= ? AND timestamp <= ?
    GROUP BY DATE(timestamp, 'localtime')
    ORDER BY date DESC
  `)
        .all(projectId, since.toISOString(), until.toISOString()) as Array<{
        date: string;
        file_creates: number;
        file_modifies: number;
        file_deletes: number;
        total: number;
    }>;

    return rows.map((r) => ({
        date: r.date,
        fileCreates: r.file_creates,
        fileModifies: r.file_modifies,
        fileDeletes: r.file_deletes,
        total: r.total,
    }));
}
