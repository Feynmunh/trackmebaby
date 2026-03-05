/**
 * Database queries for AI Chat conversations and messages
 * CRUD operations for conversations and chat_messages tables
 */
import type { Database } from "bun:sqlite";
import { safeJsonParse } from "../../../shared/error.ts";
import { nowIso } from "../../../shared/time.ts";
import type {
    ChatMessageRecord,
    Conversation,
    ScreenContext,
} from "../../../shared/types.ts";

// ─── Row types ───────────────────────────────────────────────────────────────

interface ConversationRow {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
}

interface ChatMessageRow {
    id: string;
    conversation_id: string;
    role: string;
    content: string;
    tagged_project_ids: string | null;
    screen_context: string | null;
    timestamp: string;
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapConversation(row: ConversationRow): Conversation {
    return {
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapChatMessage(row: ChatMessageRow): ChatMessageRecord {
    return {
        id: row.id,
        conversationId: row.conversation_id,
        role: row.role as "user" | "assistant",
        content: row.content,
        taggedProjectIds: safeJsonParse<string[]>(
            row.tagged_project_ids,
            [],
            "chat_message.tagged_project_ids",
        ),
        screenContext: safeJsonParse<ScreenContext | null>(
            row.screen_context,
            null,
            "chat_message.screen_context",
        ),
        timestamp: row.timestamp,
    };
}

// ─── Conversation CRUD ───────────────────────────────────────────────────────

export function createConversation(
    db: Database,
    id: string,
    title: string = "New Chat",
): Conversation {
    const now = nowIso();
    db.query(
        "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
    ).run(id, title, now, now);
    return { id, title, createdAt: now, updatedAt: now };
}

export function getConversations(db: Database): Conversation[] {
    const rows = db
        .query("SELECT * FROM conversations ORDER BY updated_at DESC")
        .all() as ConversationRow[];
    return rows.map(mapConversation);
}

export function getConversationById(
    db: Database,
    id: string,
): Conversation | null {
    const row = db
        .query("SELECT * FROM conversations WHERE id = ?")
        .get(id) as ConversationRow | null;
    return row ? mapConversation(row) : null;
}

export function updateConversationTitle(
    db: Database,
    id: string,
    title: string,
): void {
    db.query(
        "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
    ).run(title, nowIso(), id);
}

export function touchConversation(db: Database, id: string): void {
    db.query("UPDATE conversations SET updated_at = ? WHERE id = ?").run(
        nowIso(),
        id,
    );
}

export function deleteConversation(db: Database, id: string): void {
    db.query("DELETE FROM conversations WHERE id = ?").run(id);
}

// ─── Chat Message CRUD ──────────────────────────────────────────────────────

export function insertChatMessage(
    db: Database,
    msg: {
        id: string;
        conversationId: string;
        role: "user" | "assistant";
        content: string;
        taggedProjectIds?: string[];
        screenContext?: ScreenContext | null;
    },
): ChatMessageRecord {
    const now = nowIso();
    db.query(
        `INSERT INTO chat_messages (id, conversation_id, role, content, tagged_project_ids, screen_context, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
        msg.id,
        msg.conversationId,
        msg.role,
        msg.content,
        JSON.stringify(msg.taggedProjectIds ?? []),
        msg.screenContext ? JSON.stringify(msg.screenContext) : null,
        now,
    );
    touchConversation(db, msg.conversationId);
    return {
        id: msg.id,
        conversationId: msg.conversationId,
        role: msg.role,
        content: msg.content,
        taggedProjectIds: msg.taggedProjectIds ?? [],
        screenContext: msg.screenContext ?? null,
        timestamp: now,
    };
}

export function getConversationMessages(
    db: Database,
    conversationId: string,
): ChatMessageRecord[] {
    const rows = db
        .query(
            "SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY timestamp ASC",
        )
        .all(conversationId) as ChatMessageRow[];
    return rows.map(mapChatMessage);
}

export function getRecentConversationMessages(
    db: Database,
    conversationId: string,
    limit: number = 20,
): ChatMessageRecord[] {
    const rows = db
        .query(
            `SELECT * FROM (
                SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY timestamp DESC LIMIT ?
            ) sub ORDER BY timestamp ASC`,
        )
        .all(conversationId, limit) as ChatMessageRow[];
    return rows.map(mapChatMessage);
}
