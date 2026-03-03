import type { Database } from "bun:sqlite";
import { safeJsonParse } from "../../../shared/error.ts";
import { nowIso } from "../../../shared/time.ts";
import type { Project, Worktree } from "../../../shared/types.ts";

export interface ProjectRow {
    id: string;
    path: string;
    name: string;
    last_activity_at: string | null;
    created_at: string;
    worktrees: string | null;
    last_event_at?: string | null;
    last_commit_at?: string | null;
}

export function upsertProject(
    db: Database,
    path: string,
    name: string,
    lastActivityAt?: string,
    worktrees?: Worktree[],
): Project {
    const existing = db
        .query("SELECT * FROM projects WHERE path = ?")
        .get(path) as ProjectRow | null;
    const worktreesJson = JSON.stringify(worktrees || []);

    if (existing) {
        let shouldUpdate = false;
        if (existing.name !== name) shouldUpdate = true;
        if (lastActivityAt && existing.last_activity_at !== lastActivityAt)
            shouldUpdate = true;
        if (
            worktrees &&
            worktrees.length > 0 &&
            existing.worktrees !== worktreesJson
        )
            shouldUpdate = true;

        if (shouldUpdate) {
            db.query(
                "UPDATE projects SET name = ?, last_activity_at = ?, worktrees = ? WHERE path = ?",
            ).run(
                name,
                lastActivityAt || existing.last_activity_at,
                worktreesJson,
                path,
            );
            return mapProject(
                db
                    .query("SELECT * FROM projects WHERE path = ?")
                    .get(path) as ProjectRow,
            );
        }
        return mapProject(existing);
    }

    const id = Bun.randomUUIDv7();
    const now = nowIso();
    const finalActivity = lastActivityAt || now;
    db.query(
        "INSERT INTO projects (id, path, name, last_activity_at, created_at, worktrees) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(id, path, name, finalActivity, now, worktreesJson);

    return {
        id,
        path,
        name,
        lastActivityAt: finalActivity,
        createdAt: now,
        worktrees: worktrees || [],
    };
}

export function getProjects(db: Database): Project[] {
    const rows = db
        .query(`
        SELECT 
            p.*,
            (SELECT MAX(timestamp) FROM events WHERE project_id = p.id) as last_event_at,
            (SELECT MAX(last_commit_timestamp) FROM git_snapshots WHERE project_id = p.id) as last_commit_at
        FROM projects p
        ORDER BY COALESCE(last_event_at, last_commit_at, last_activity_at, created_at) DESC
    `)
        .all() as ProjectRow[];

    return rows.map((row) => {
        const project = mapProject(row);
        project.lastActivityAt =
            row.last_event_at ||
            row.last_commit_at ||
            row.last_activity_at ||
            row.created_at;
        return project;
    });
}

export function getProjectById(db: Database, id: string): Project | null {
    const row = db
        .query("SELECT * FROM projects WHERE id = ?")
        .get(id) as ProjectRow | null;
    return row ? mapProject(row) : null;
}

export function getProjectByPath(db: Database, path: string): Project | null {
    const row = db
        .query("SELECT * FROM projects WHERE path = ?")
        .get(path) as ProjectRow | null;
    return row ? mapProject(row) : null;
}

export function deleteProject(db: Database, id: string): boolean {
    const project = getProjectById(db, id);
    if (project) {
        db.query(
            "INSERT OR REPLACE INTO deleted_projects (path, deleted_at) VALUES (?, ?)",
        ).run(project.path, nowIso());
    }
    db.query("DELETE FROM project_caches WHERE project_id = ?").run(id);
    db.query("DELETE FROM git_snapshots WHERE project_id = ?").run(id);
    db.query("DELETE FROM events WHERE project_id = ?").run(id);
    db.query("DELETE FROM projects WHERE id = ?").run(id);
    return true;
}

export function isProjectPathDeleted(db: Database, path: string): boolean {
    const row = db
        .query("SELECT path FROM deleted_projects WHERE path = ?")
        .get(path);
    return row !== null;
}

export function mapProject(row: ProjectRow): Project {
    const worktrees = safeJsonParse<Worktree[]>(
        row.worktrees,
        [],
        "[DB] Failed to parse worktrees JSON:",
    );

    return {
        id: row.id,
        path: row.path,
        name: row.name,
        lastActivityAt: row.last_activity_at,
        createdAt: row.created_at,
        worktrees,
    };
}
