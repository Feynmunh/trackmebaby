/**
 * Database queries for Resource Vault
 * CRUD operations for vault_resources table
 */
import type { Database } from "bun:sqlite";
import { safeJsonParse } from "../../../shared/error.ts";
import { nowIso } from "../../../shared/time.ts";
import type {
    LinkPreview,
    VaultResource,
    VaultResourceType,
} from "../../../shared/types.ts";

// ─── Row mapping ─────────────────────────────────────────────────────────────

interface VaultResourceRow {
    id: string;
    project_id: string;
    type: string;
    title: string;
    content: string;
    url: string | null;
    link_preview: string | null;
    is_pinned: number;
    tags: string | null;
    created_at: string;
    updated_at: string;
}

function mapVaultResource(row: VaultResourceRow): VaultResource {
    return {
        id: row.id,
        projectId: row.project_id,
        type: row.type as VaultResourceType,
        title: row.title,
        content: row.content,
        url: row.url,
        linkPreview: safeJsonParse<LinkPreview | null>(
            row.link_preview,
            null,
            "[DB] Failed to parse link_preview:",
        ),
        isPinned: row.is_pinned === 1,
        tags: safeJsonParse<string[]>(
            row.tags,
            [],
            "[DB] Failed to parse tags:",
        ),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function getVaultResources(
    db: Database,
    projectId: string,
    type?: VaultResourceType,
): VaultResource[] {
    const query = type
        ? db.query(
              `SELECT * FROM vault_resources
               WHERE project_id = ? AND type = ?
               ORDER BY is_pinned DESC, created_at DESC`,
          )
        : db.query(
              `SELECT * FROM vault_resources
               WHERE project_id = ?
               ORDER BY is_pinned DESC, created_at DESC`,
          );

    const rows = (
        type ? query.all(projectId, type) : query.all(projectId)
    ) as VaultResourceRow[];
    return rows.map(mapVaultResource);
}

export function getVaultResourceById(
    db: Database,
    id: string,
): VaultResource | null {
    const row = db
        .query("SELECT * FROM vault_resources WHERE id = ?")
        .get(id) as VaultResourceRow | null;
    return row ? mapVaultResource(row) : null;
}

export function insertVaultResource(
    db: Database,
    projectId: string,
    type: VaultResourceType,
    title: string,
    content: string,
    url?: string | null,
    tags?: string[],
): VaultResource {
    const id = Bun.randomUUIDv7();
    const now = nowIso();

    db.query(
        `INSERT INTO vault_resources
         (id, project_id, type, title, content, url, is_pinned, tags, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    ).run(
        id,
        projectId,
        type,
        title,
        content,
        url ?? null,
        JSON.stringify(tags ?? []),
        now,
        now,
    );

    return {
        id,
        projectId,
        type,
        title,
        content,
        url: url ?? null,
        linkPreview: null,
        isPinned: false,
        tags: tags ?? [],
        createdAt: now,
        updatedAt: now,
    };
}

export function updateVaultResource(
    db: Database,
    id: string,
    updates: {
        title?: string;
        content?: string;
        type?: VaultResourceType;
        tags?: string[];
    },
): boolean {
    const sets: string[] = [];
    const values: unknown[] = [];

    if (updates.title !== undefined) {
        sets.push("title = ?");
        values.push(updates.title);
    }
    if (updates.content !== undefined) {
        sets.push("content = ?");
        values.push(updates.content);
    }
    if (updates.type !== undefined) {
        sets.push("type = ?");
        values.push(updates.type);
    }
    if (updates.tags !== undefined) {
        sets.push("tags = ?");
        values.push(JSON.stringify(updates.tags));
    }

    if (sets.length === 0) return false;

    sets.push("updated_at = ?");
    values.push(nowIso());
    values.push(id);

    const result = db
        .query(`UPDATE vault_resources SET ${sets.join(", ")} WHERE id = ?`)
        .run(...(values as [string, ...string[]]));
    return (result as { changes: number }).changes > 0;
}

export function updateVaultResourceLinkPreview(
    db: Database,
    id: string,
    linkPreview: LinkPreview,
): void {
    db.query(
        "UPDATE vault_resources SET link_preview = ?, updated_at = ? WHERE id = ?",
    ).run(JSON.stringify(linkPreview), nowIso(), id);
}

export function deleteVaultResource(db: Database, id: string): boolean {
    const result = db.query("DELETE FROM vault_resources WHERE id = ?").run(id);
    return (result as { changes: number }).changes > 0;
}

export function toggleVaultResourcePin(
    db: Database,
    id: string,
): { success: boolean; isPinned: boolean } {
    const row = db
        .query("SELECT is_pinned FROM vault_resources WHERE id = ?")
        .get(id) as { is_pinned: number } | null;

    if (!row) return { success: false, isPinned: false };

    const newPinned = row.is_pinned === 1 ? 0 : 1;
    db.query(
        "UPDATE vault_resources SET is_pinned = ?, updated_at = ? WHERE id = ?",
    ).run(newPinned, nowIso(), id);

    return { success: true, isPinned: newPinned === 1 };
}
