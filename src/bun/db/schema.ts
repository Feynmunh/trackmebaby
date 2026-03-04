/**
 * SQLite schema definitions and migrations for trackmebaby
 * Defines all tables and runs migrations on initialization
 */
import type { Database } from "bun:sqlite";
import { toErrorData } from "../../shared/error.ts";
import { createLogger } from "../../shared/logger.ts";

const SCHEMA_VERSION = 6;
const logger = createLogger("db");

export function runMigrations(db: Database): void {
    // Enable WAL mode for concurrent read/write performance
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");

    // Create schema version tracking
    db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    )
  `);

    const currentVersion = db
        .query("SELECT MAX(version) as v FROM schema_version")
        .get() as { v: number | null } | null;
    const version = currentVersion?.v ?? 0;

    if (version < 1) {
        applyMigration1(db);
    }
    if (version < 2) {
        applyMigration2(db);
    }
    if (version < 3) {
        applyMigration3(db);
    }
    if (version < 4) {
        applyMigration4(db);
    }
    if (version < 5) {
        applyMigration5(db);
    }
    if (version < 6) {
        applyMigration6(db);
    }
    if (version < SCHEMA_VERSION) {
        db.exec(
            `INSERT OR REPLACE INTO schema_version (version) VALUES (${SCHEMA_VERSION})`,
        );
    }
}

function applyMigration1(db: Database): void {
    // Projects table
    db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      path TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      last_activity_at TEXT,
      created_at TEXT NOT NULL
    )
  `);

    // File events table
    db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      data TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )
  `);

    // Git snapshots table
    db.exec(`
    CREATE TABLE IF NOT EXISTS git_snapshots (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      branch TEXT NOT NULL,
      last_commit_hash TEXT,
      last_commit_message TEXT,
      last_commit_timestamp TEXT,
      uncommitted_count INTEGER DEFAULT 0,
      uncommitted_files TEXT,
      data TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )
  `);

    // Settings table (key-value store)
    db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
}

function applyMigration2(db: Database): void {
    // Add worktrees column to projects table
    try {
        db.exec(`ALTER TABLE projects ADD COLUMN worktrees TEXT DEFAULT '[]'`);
    } catch (err: unknown) {
        logger.warn("migration 2 skipped", { error: toErrorData(err) });
    }
}

function applyMigration3(db: Database): void {
    db.exec(`
    CREATE TABLE IF NOT EXISTS project_caches (
      project_id TEXT PRIMARY KEY,
      stats_json TEXT,
      stats_updated_at TEXT,
      github_json TEXT,
      github_etag TEXT,
      github_updated_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )
  `);
}

function applyMigration4(db: Database): void {
    db.exec(`
    CREATE TABLE IF NOT EXISTS warden_insights (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'new',
      severity TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      affected_files TEXT,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    )
  `);
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_warden_insights_project_status
      ON warden_insights(project_id, status)
  `);
}

function applyMigration5(db: Database): void {
    db.exec(`
    CREATE TABLE IF NOT EXISTS deleted_projects (
      path TEXT PRIMARY KEY,
      deleted_at TEXT NOT NULL
    )
  `);
}

function applyMigration6(db: Database): void {
    db.exec(`
    CREATE TABLE IF NOT EXISTS vault_resources (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'note',
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      url TEXT,
      link_preview TEXT,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      tags TEXT DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_vault_resources_project
      ON vault_resources(project_id, is_pinned DESC, created_at DESC)
  `);
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_vault_resources_project_type
      ON vault_resources(project_id, type, is_pinned DESC, created_at DESC)
  `);
}
