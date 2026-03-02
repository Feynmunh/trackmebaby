import type { Database } from "bun:sqlite";
import { safeJsonParse } from "../../../shared/error.ts";
import { nowIso } from "../../../shared/time.ts";
import type {
    WardenCategory,
    WardenInsight,
    WardenInsightStatus,
    WardenSeverity,
} from "../../../shared/types.ts";

interface WardenInsightRow {
    id: string;
    project_id: string;
    status: string;
    severity: string;
    category: string;
    title: string;
    description: string;
    affected_files: string | null;
    created_at: string;
    resolved_at: string | null;
}

function mapWardenInsight(row: WardenInsightRow): WardenInsight {
    return {
        id: row.id,
        projectId: row.project_id,
        status: row.status as WardenInsightStatus,
        severity: row.severity as WardenSeverity,
        category: row.category as WardenCategory,
        title: row.title,
        description: row.description,
        affectedFiles: safeJsonParse<string[] | null>(
            row.affected_files,
            null,
            "[DB] Failed to parse affected_files:",
        ),
        createdAt: row.created_at,
        resolvedAt: row.resolved_at,
    };
}

export function insertWardenInsight(
    db: Database,
    projectId: string,
    severity: WardenSeverity,
    category: WardenCategory,
    title: string,
    description: string,
    affectedFiles?: string[] | null,
): WardenInsight {
    const id = Bun.randomUUIDv7();
    const status = "new";
    const createdAt = nowIso();
    const resolvedAt = null;

    db.query(
        `INSERT INTO warden_insights
         (id, project_id, status, severity, category, title, description, affected_files, created_at, resolved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
        id,
        projectId,
        status,
        severity,
        category,
        title,
        description,
        affectedFiles ? JSON.stringify(affectedFiles) : null,
        createdAt,
        resolvedAt,
    );

    return {
        id,
        projectId,
        status: status as WardenInsightStatus,
        severity,
        category,
        title,
        description,
        affectedFiles: affectedFiles ?? null,
        createdAt,
        resolvedAt,
    };
}

export function getWardenInsights(
    db: Database,
    projectId: string,
    status?: WardenInsightStatus,
): WardenInsight[] {
    let rows: WardenInsightRow[];
    if (status) {
        rows = db
            .query(
                "SELECT * FROM warden_insights WHERE project_id = ? AND status = ? ORDER BY created_at DESC",
            )
            .all(projectId, status) as WardenInsightRow[];
    } else {
        rows = db
            .query(
                "SELECT * FROM warden_insights WHERE project_id = ? ORDER BY created_at DESC",
            )
            .all(projectId) as WardenInsightRow[];
    }

    return rows.map(mapWardenInsight);
}

export function getWardenInsight(
    db: Database,
    insightId: string,
): WardenInsight | null {
    const row = db
        .query("SELECT * FROM warden_insights WHERE id = ?")
        .get(insightId) as WardenInsightRow | null;
    return row ? mapWardenInsight(row) : null;
}

export function updateWardenInsightStatus(
    db: Database,
    insightId: string,
    newStatus: WardenInsightStatus,
): boolean {
    const current = db
        .query("SELECT status, resolved_at FROM warden_insights WHERE id = ?")
        .get(insightId) as {
        status: string;
        resolved_at: string | null;
    } | null;

    if (!current) return false;

    let resolvedAt: string | null = current.resolved_at;
    if (newStatus === "new") {
        resolvedAt = null;
    } else if (current.status === "new" && !resolvedAt) {
        resolvedAt = nowIso();
    }

    const result = db
        .query(
            "UPDATE warden_insights SET status = ?, resolved_at = ? WHERE id = ?",
        )
        .run(newStatus, resolvedAt, insightId);

    return (result.changes as number) > 0;
}

export function deleteWardenInsightsByProject(
    db: Database,
    projectId: string,
): void {
    db.query("DELETE FROM warden_insights WHERE project_id = ?").run(projectId);
}

export function getWardenInsightCountsByProject(
    db: Database,
    projectId: string,
): { new: number; approved: number; liked: number } {
    const rows = db
        .query(
            "SELECT status, COUNT(*) as count FROM warden_insights WHERE project_id = ? AND status IN ('new', 'approved', 'liked') GROUP BY status",
        )
        .all(projectId) as { status: string; count: number }[];

    const counts = { new: 0, approved: 0, liked: 0 };
    for (const row of rows) {
        if (row.status in counts) {
            counts[row.status as keyof typeof counts] = row.count;
        }
    }
    return counts;
}
