/**
 * Prepared database queries for trackmebaby
 * All CRUD operations with UUIDv7 primary keys
 */
import type { Database } from "bun:sqlite";
import type { Project, Worktree, ActivityEvent, GitSnapshot, ActivitySummary } from "../../shared/types.ts";

// --- Projects ---

export function upsertProject(db: Database, path: string, name: string, lastActivityAt?: string, worktrees?: Worktree[]): Project {
    const existing = db.query("SELECT * FROM projects WHERE path = ?").get(path) as any;
    const worktreesJson = JSON.stringify(worktrees || []);

    if (existing) {
        let shouldUpdate = false;
        if (existing.name !== name) shouldUpdate = true;
        if (lastActivityAt && existing.last_activity_at !== lastActivityAt) shouldUpdate = true;
        if (worktrees && worktrees.length > 0 && existing.worktrees !== worktreesJson) shouldUpdate = true;

        if (shouldUpdate) {
            db.query("UPDATE projects SET name = ?, last_activity_at = ?, worktrees = ? WHERE path = ?")
                .run(name, lastActivityAt || existing.last_activity_at, worktreesJson, path);
            return mapProject(db.query("SELECT * FROM projects WHERE path = ?").get(path) as any);
        }
        return mapProject(existing);
    }

    const id = Bun.randomUUIDv7();
    const now = new Date().toISOString();
    const finalActivity = lastActivityAt || now;
    db.query("INSERT INTO projects (id, path, name, last_activity_at, created_at, worktrees) VALUES (?, ?, ?, ?, ?, ?)")
        .run(id, path, name, finalActivity, now, worktreesJson);

    return { id, path, name, lastActivityAt: finalActivity, createdAt: now, worktrees: worktrees || [] };
}

export function getProjects(db: Database): Project[] {
    // We derive lastActive strictly from data:
    // 1. The latest event in the events table
    // 2. The latest commit timestamp from git_snapshots
    // 3. The historical activity date from the scanner (last_activity_at)
    // 4. Falling back to the project's own created_at
    const rows = db.query(`
        SELECT 
            p.*,
            (SELECT MAX(timestamp) FROM events WHERE project_id = p.id) as last_event_at,
            (SELECT MAX(last_commit_timestamp) FROM git_snapshots WHERE project_id = p.id) as last_commit_at
        FROM projects p
        ORDER BY COALESCE(last_event_at, last_commit_at, last_activity_at, created_at) DESC
    `).all() as any[];

    return rows.map(row => {
        const project = mapProject(row);
        // Priority: File Events > Git Snapshots > Scanner History > Creation Date
        project.lastActivityAt = row.last_event_at || row.last_commit_at || row.last_activity_at || row.created_at;
        return project;
    });
}

export function getProjectById(db: Database, id: string): Project | null {
    const row = db.query("SELECT * FROM projects WHERE id = ?").get(id) as any;
    return row ? mapProject(row) : null;
}

export function getProjectByPath(db: Database, path: string): Project | null {
    const row = db.query("SELECT * FROM projects WHERE path = ?").get(path) as any;
    return row ? mapProject(row) : null;
}

function mapProject(row: any): Project {
    let worktrees: Worktree[] = [];
    try {
        worktrees = row.worktrees ? JSON.parse(row.worktrees) : [];
    } catch { /* malformed JSON — treat as no worktrees */ }

    return {
        id: row.id,
        path: row.path,
        name: row.name,
        lastActivityAt: row.last_activity_at,
        createdAt: row.created_at,
        worktrees,
    };
}

// --- Events ---

export function insertEvent(
    db: Database,
    projectId: string,
    type: "file_create" | "file_modify" | "file_delete",
    filePath: string,
    data?: string
): ActivityEvent {
    const id = Bun.randomUUIDv7();
    const timestamp = new Date().toISOString();

    db.query("INSERT INTO events (id, project_id, timestamp, type, file_path, data) VALUES (?, ?, ?, ?, ?, ?)")
        .run(id, projectId, timestamp, type, filePath, data ?? null);

    // Update project last_activity_at
    db.query("UPDATE projects SET last_activity_at = ? WHERE id = ?").run(timestamp, projectId);

    return { id, projectId, timestamp, type, filePath, data };
}

export function getRecentEvents(
    db: Database,
    projectId: string,
    since: Date,
    limit: number = 100
): ActivityEvent[] {
    const rows = db.query(
        "SELECT * FROM events WHERE project_id = ? AND timestamp >= ? ORDER BY id DESC LIMIT ?"
    ).all(projectId, since.toISOString(), limit) as any[];

    return rows.map(mapEvent);
}

export function getAllRecentEvents(
    db: Database,
    since: Date,
    limit: number = 500
): ActivityEvent[] {
    const rows = db.query(
        "SELECT * FROM events WHERE timestamp >= ? ORDER BY id DESC LIMIT ?"
    ).all(since.toISOString(), limit) as any[];

    return rows.map(mapEvent);
}

function mapEvent(row: any): ActivityEvent {
    return {
        id: row.id,
        projectId: row.project_id,
        timestamp: row.timestamp,
        type: row.type,
        filePath: row.file_path,
        data: row.data,
    };
}

// --- Git Snapshots ---

export function insertGitSnapshot(
    db: Database,
    projectId: string,
    branch: string,
    commitHash: string | null,
    commitMsg: string | null,
    commitTs: string | null,
    uncommittedCount: number,
    uncommittedFiles: string[],
    data?: string
): GitSnapshot {
    const id = Bun.randomUUIDv7();
    const timestamp = new Date().toISOString();

    db.query(
        `INSERT INTO git_snapshots
     (id, project_id, timestamp, branch, last_commit_hash, last_commit_message,
      last_commit_timestamp, uncommitted_count, uncommitted_files, data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        id, projectId, timestamp, branch, commitHash, commitMsg,
        commitTs, uncommittedCount, JSON.stringify(uncommittedFiles), data ?? null
    );

    // Note: We don't update projects.last_activity_at here anymore.
    // Activity should only be updated by direct file events in insertEvent().

    return {
        id, projectId, timestamp, branch,
        lastCommitHash: commitHash,
        lastCommitMessage: commitMsg,
        lastCommitTimestamp: commitTs,
        uncommittedCount,
        uncommittedFiles,
        data,
    };
}

export function getLatestGitSnapshot(db: Database, projectId: string): GitSnapshot | null {
    const row = db.query(
        "SELECT * FROM git_snapshots WHERE project_id = ? ORDER BY id DESC LIMIT 1"
    ).get(projectId) as any;

    return row ? mapGitSnapshot(row) : null;
}

export function getGitSnapshots(
    db: Database,
    projectId: string,
    since: Date,
    limit: number = 50
): GitSnapshot[] {
    const rows = db.query(
        "SELECT * FROM git_snapshots WHERE project_id = ? AND timestamp >= ? ORDER BY id DESC LIMIT ?"
    ).all(projectId, since.toISOString(), limit) as any[];

    return rows.map(mapGitSnapshot);
}

function mapGitSnapshot(row: any): GitSnapshot {
    return {
        id: row.id,
        projectId: row.project_id,
        timestamp: row.timestamp,
        branch: row.branch,
        lastCommitHash: row.last_commit_hash,
        lastCommitMessage: row.last_commit_message,
        lastCommitTimestamp: row.last_commit_timestamp,
        uncommittedCount: row.uncommitted_count,
        uncommittedFiles: row.uncommitted_files ? JSON.parse(row.uncommitted_files) : [],
        data: row.data,
    };
}

// --- Settings ---

export function getSetting(db: Database, key: string): string | null {
    const row = db.query("SELECT value FROM settings WHERE key = ?").get(key) as any;
    return row ? row.value : null;
}

export function setSetting(db: Database, key: string, value: string): void {
    db.query("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
}

// --- Activity Summary ---

export function getActivitySummary(
    db: Database,
    projectId: string,
    since: Date,
    until: Date
): ActivitySummary[] {
    const rows = db.query(`
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
  `).all(projectId, since.toISOString(), until.toISOString()) as any[];

    return rows.map((r: any) => ({
        date: r.date,
        fileCreates: r.file_creates,
        fileModifies: r.file_modifies,
        fileDeletes: r.file_deletes,
        total: r.total,
    }));
}
