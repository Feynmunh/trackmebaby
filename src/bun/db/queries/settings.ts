import type { Database } from "bun:sqlite";

export interface SettingRow {
    value: string;
}

export function getSetting(db: Database, key: string): string | null {
    const row = db
        .query("SELECT value FROM settings WHERE key = ?")
        .get(key) as SettingRow | null;
    return row ? row.value : null;
}

export function setSetting(db: Database, key: string, value: string): void {
    db.query("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(
        key,
        value,
    );
}
