/**
 * Database singleton — wraps bun:sqlite with WAL mode
 * Stores DB at platform-appropriate location
 */
import { Database } from "bun:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { runMigrations } from "./schema.ts";

let dbInstance: Database | null = null;

/**
 * Get the database file path.
 * In Electrobun, use Utils.paths.userData for app-scoped data.
 * For standalone/testing, fallback to a local path.
 */
function getDbPath(): string {
    // Use XDG data home or local fallback
    // When running inside Electrobun, the caller passes a custom path via getDatabase(path)
    const xdgData = process.env.XDG_DATA_HOME || join(process.env.HOME || "/tmp", ".local", "share");
    const appDir = join(xdgData, "trackmebaby");
    mkdirSync(appDir, { recursive: true });
    return join(appDir, "trackmebaby.db");
}

/**
 * Initialize and return the database singleton.
 * Creates the database file and runs migrations if needed.
 */
export function getDatabase(customPath?: string): Database {
    if (dbInstance) return dbInstance;

    const dbPath = customPath || getDbPath();
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }

    dbInstance = new Database(dbPath);
    runMigrations(dbInstance);
    return dbInstance;
}

/**
 * Close the database connection (for graceful shutdown).
 */
export function closeDatabase(): void {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
    }
}

/**
 * Get an in-memory database (for testing).
 */
export function getTestDatabase(): Database {
    const db = new Database(":memory:");
    runMigrations(db);
    return db;
}
