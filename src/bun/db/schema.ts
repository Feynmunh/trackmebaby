/**
 * SQLite schema definitions and migrations for trackmebaby
 * Defines all tables and runs migrations on initialization
 */
import { Database } from "bun:sqlite";

const SCHEMA_VERSION = 1;

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

    const currentVersion = db.query("SELECT MAX(version) as v FROM schema_version").get() as { v: number | null } | null;
    const version = currentVersion?.v ?? 0;

    if (version < SCHEMA_VERSION) {
        applyMigration1(db);
        db.exec(`INSERT OR REPLACE INTO schema_version (version) VALUES (${SCHEMA_VERSION})`);
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
