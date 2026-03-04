import type { Database } from "bun:sqlite";
import { safeJsonParse } from "../../../shared/error.ts";
import { nowIso } from "../../../shared/time.ts";
import type { GitSnapshot } from "../../../shared/types.ts";

export interface GitSnapshotRow {
    id: string;
    project_id: string;
    timestamp: string;
    branch: string;
    last_commit_hash: string | null;
    last_commit_message: string | null;
    last_commit_timestamp: string | null;
    uncommitted_count: number;
    uncommitted_files: string | null;
    data?: string | null;
}

export function insertGitSnapshot(
    db: Database,
    projectId: string,
    branch: string,
    commitHash: string | null,
    commitMsg: string | null,
    commitTs: string | null,
    uncommittedCount: number,
    uncommittedFiles: string[],
    data?: string,
): GitSnapshot {
    const id = Bun.randomUUIDv7();
    const timestamp = nowIso();

    db.query(
        `INSERT INTO git_snapshots
     (id, project_id, timestamp, branch, last_commit_hash, last_commit_message,
      last_commit_timestamp, uncommitted_count, uncommitted_files, data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
        id,
        projectId,
        timestamp,
        branch,
        commitHash,
        commitMsg,
        commitTs,
        uncommittedCount,
        JSON.stringify(uncommittedFiles),
        data ?? null,
    );

    return {
        id,
        projectId,
        timestamp,
        branch,
        lastCommitHash: commitHash,
        lastCommitMessage: commitMsg,
        lastCommitTimestamp: commitTs,
        uncommittedCount,
        uncommittedFiles,
        data,
    };
}

export function getLatestGitSnapshot(
    db: Database,
    projectId: string,
): GitSnapshot | null {
    const row = db
        .query(
            "SELECT * FROM git_snapshots WHERE project_id = ? ORDER BY id DESC LIMIT 1",
        )
        .get(projectId) as GitSnapshotRow | null;

    return row ? mapGitSnapshot(row) : null;
}

export function getGitSnapshots(
    db: Database,
    projectId: string,
    since: Date,
    limit: number = 50,
): GitSnapshot[] {
    const rows = db
        .query(
            "SELECT * FROM git_snapshots WHERE project_id = ? AND timestamp >= ? ORDER BY id DESC LIMIT ?",
        )
        .all(projectId, since.toISOString(), limit) as GitSnapshotRow[];

    return rows.map(mapGitSnapshot);
}

export function mapGitSnapshot(row: GitSnapshotRow): GitSnapshot {
    return {
        id: row.id,
        projectId: row.project_id,
        timestamp: row.timestamp,
        branch: row.branch,
        lastCommitHash: row.last_commit_hash,
        lastCommitMessage: row.last_commit_message,
        lastCommitTimestamp: row.last_commit_timestamp,
        uncommittedCount: row.uncommitted_count,
        uncommittedFiles: safeJsonParse<string[]>(
            row.uncommitted_files,
            [],
            "[DB] Failed to parse uncommitted files JSON:",
        ),
        data: row.data ?? undefined,
    };
}

export function hasGitSnapshots(db: Database, projectId: string): boolean {
    const result = db
        .query("SELECT 1 FROM git_snapshots WHERE project_id = ? LIMIT 1")
        .get(projectId);
    return result !== null;
}
