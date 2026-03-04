/**
 * Tests for chat query module: conversation and message CRUD,
 * ordering, JSON fallback behaviour, and cascade deletes.
 */

import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { runMigrations } from "../schema.ts";
import {
    createConversation,
    deleteConversation,
    getConversationById,
    getConversationMessages,
    getConversations,
    getRecentConversationMessages,
    insertChatMessage,
    touchConversation,
    updateConversationTitle,
} from "./chat.ts";

let db: Database;

beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
});

afterEach(() => {
    db.close();
});

// ─── Conversation CRUD ───────────────────────────────────────────────────────

describe("createConversation", () => {
    test("creates a conversation with default title", () => {
        const convo = createConversation(db, "test-id-1");
        expect(convo.id).toBe("test-id-1");
        expect(convo.title).toBe("New Chat");
        expect(convo.createdAt).toBeTruthy();
        expect(convo.updatedAt).toBeTruthy();
    });

    test("creates a conversation with custom title", () => {
        const convo = createConversation(db, "test-id-2", "My Project Chat");
        expect(convo.title).toBe("My Project Chat");
    });

    test("persists to database and is retrievable", () => {
        createConversation(db, "persist-id", "Persisted");
        const retrieved = getConversationById(db, "persist-id");
        expect(retrieved).not.toBeNull();
        expect(retrieved?.title).toBe("Persisted");
    });
});

describe("getConversations", () => {
    test("returns empty array when no conversations exist", () => {
        const convos = getConversations(db);
        expect(convos).toEqual([]);
    });

    test("returns all conversations ordered by updated_at DESC", async () => {
        createConversation(db, "old-id", "Older");
        // small delay so timestamps differ
        await new Promise((r) => setTimeout(r, 10));
        createConversation(db, "new-id", "Newer");

        const convos = getConversations(db);
        expect(convos).toHaveLength(2);
        expect(convos[0].id).toBe("new-id");
        expect(convos[1].id).toBe("old-id");
    });
});

describe("getConversationById", () => {
    test("returns null for non-existent id", () => {
        expect(getConversationById(db, "ghost")).toBeNull();
    });

    test("returns the correct conversation", () => {
        createConversation(db, "find-me", "Find Me");
        const result = getConversationById(db, "find-me");
        expect(result?.title).toBe("Find Me");
    });
});

describe("updateConversationTitle", () => {
    test("updates the title field", () => {
        createConversation(db, "rename-id", "Old Title");
        updateConversationTitle(db, "rename-id", "New Title");
        const updated = getConversationById(db, "rename-id");
        expect(updated?.title).toBe("New Title");
    });
});

describe("touchConversation", () => {
    test("updates updated_at timestamp", async () => {
        const convo = createConversation(db, "touch-id", "Touch Me");
        const originalUpdatedAt = convo.updatedAt;
        await new Promise((r) => setTimeout(r, 20));
        touchConversation(db, "touch-id");
        const touched = getConversationById(db, "touch-id");
        expect(touched?.updatedAt).not.toBe(originalUpdatedAt);
    });
});

describe("deleteConversation", () => {
    test("removes the conversation", () => {
        createConversation(db, "del-id", "Delete Me");
        deleteConversation(db, "del-id");
        expect(getConversationById(db, "del-id")).toBeNull();
    });

    test("cascade-deletes associated messages", () => {
        createConversation(db, "cascade-id", "Cascade");
        insertChatMessage(db, {
            id: "msg-1",
            conversationId: "cascade-id",
            role: "user",
            content: "Hello",
        });
        deleteConversation(db, "cascade-id");
        const messages = getConversationMessages(db, "cascade-id");
        expect(messages).toHaveLength(0);
    });
});

// ─── Chat Message CRUD ───────────────────────────────────────────────────────

describe("insertChatMessage", () => {
    test("inserts a message and returns it", () => {
        createConversation(db, "conv-1", "Conv");
        const msg = insertChatMessage(db, {
            id: "msg-insert",
            conversationId: "conv-1",
            role: "user",
            content: "Hello world",
        });
        expect(msg.id).toBe("msg-insert");
        expect(msg.role).toBe("user");
        expect(msg.content).toBe("Hello world");
        expect(msg.taggedProjectIds).toEqual([]);
        expect(msg.screenContext).toBeNull();
    });

    test("stores tagged project ids", () => {
        createConversation(db, "conv-2", "Conv");
        const msg = insertChatMessage(db, {
            id: "msg-tags",
            conversationId: "conv-2",
            role: "user",
            content: "Tagged",
            taggedProjectIds: ["proj-a", "proj-b"],
        });
        expect(msg.taggedProjectIds).toEqual(["proj-a", "proj-b"]);
    });

    test("stores screen context", () => {
        createConversation(db, "conv-3", "Conv");
        const sc = {
            activeTab: "cards",
            selectedProjectId: "p-1",
            selectedProjectName: "myapp",
            visibleData: null,
        };
        const msg = insertChatMessage(db, {
            id: "msg-sc",
            conversationId: "conv-3",
            role: "user",
            content: "Context test",
            screenContext: sc,
        });
        expect(msg.screenContext).toEqual(sc);
    });

    test("touches the parent conversation's updated_at", async () => {
        const convo = createConversation(db, "conv-touch", "Conv");
        const originalUpdatedAt = convo.updatedAt;
        await new Promise((r) => setTimeout(r, 20));
        insertChatMessage(db, {
            id: "msg-touch",
            conversationId: "conv-touch",
            role: "user",
            content: "Touch parent",
        });
        const updated = getConversationById(db, "conv-touch");
        expect(updated?.updatedAt).not.toBe(originalUpdatedAt);
    });
});

describe("getConversationMessages", () => {
    test("returns messages in ascending timestamp order", async () => {
        createConversation(db, "order-conv", "Order");
        insertChatMessage(db, {
            id: "m1",
            conversationId: "order-conv",
            role: "user",
            content: "First",
        });
        await new Promise((r) => setTimeout(r, 10));
        insertChatMessage(db, {
            id: "m2",
            conversationId: "order-conv",
            role: "assistant",
            content: "Second",
        });

        const msgs = getConversationMessages(db, "order-conv");
        expect(msgs[0].id).toBe("m1");
        expect(msgs[1].id).toBe("m2");
    });

    test("returns empty array for unknown conversationId", () => {
        expect(getConversationMessages(db, "nonexistent")).toEqual([]);
    });
});

describe("getRecentConversationMessages", () => {
    test("limits results to the specified count", async () => {
        createConversation(db, "limit-conv", "Limit");
        for (let i = 0; i < 10; i++) {
            await new Promise((r) => setTimeout(r, 5));
            insertChatMessage(db, {
                id: `lm-${i}`,
                conversationId: "limit-conv",
                role: i % 2 === 0 ? "user" : "assistant",
                content: `Message ${i}`,
            });
        }

        const recent = getRecentConversationMessages(db, "limit-conv", 3);
        expect(recent).toHaveLength(3);
    });

    test("returns the most recent messages in ascending order", async () => {
        createConversation(db, "recent-conv", "Recent");
        for (let i = 0; i < 5; i++) {
            await new Promise((r) => setTimeout(r, 5));
            insertChatMessage(db, {
                id: `rm-${i}`,
                conversationId: "recent-conv",
                role: "user",
                content: `Message ${i}`,
            });
        }

        const recent = getRecentConversationMessages(db, "recent-conv", 3);
        // Should be messages 2, 3, 4 in ascending order
        expect(recent.map((m) => m.content)).toEqual([
            "Message 2",
            "Message 3",
            "Message 4",
        ]);
    });
});

// ─── JSON fallback behaviour ─────────────────────────────────────────────────

describe("JSON fallback", () => {
    test("tagged_project_ids falls back to [] on malformed JSON", () => {
        createConversation(db, "fallback-conv", "Fallback");
        // Insert a row with deliberately broken JSON directly
        db.run(
            `INSERT INTO chat_messages (id, conversation_id, role, content, tagged_project_ids, screen_context, timestamp)
             VALUES ('bad-json-msg', 'fallback-conv', 'user', 'test', 'NOT_VALID_JSON', NULL, datetime('now'))`,
        );
        const msgs = getConversationMessages(db, "fallback-conv");
        expect(msgs[0].taggedProjectIds).toEqual([]);
    });

    test("screen_context falls back to null on malformed JSON", () => {
        createConversation(db, "fallback-conv-2", "Fallback 2");
        db.run(
            `INSERT INTO chat_messages (id, conversation_id, role, content, tagged_project_ids, screen_context, timestamp)
             VALUES ('bad-sc-msg', 'fallback-conv-2', 'user', 'test', '[]', 'BROKEN{JSON', datetime('now'))`,
        );
        const msgs = getConversationMessages(db, "fallback-conv-2");
        expect(msgs[0].screenContext).toBeNull();
    });
});
