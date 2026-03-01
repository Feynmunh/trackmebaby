/**
 * Tests for AI context assembler
 */

import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { nowIso } from "../../../shared/time.ts";
import {
    insertEvent,
    insertGitSnapshot,
    upsertProject,
} from "../../db/queries.ts";
import { runMigrations } from "../../db/schema.ts";
import { assembleContext } from "./context-assembler.ts";

let db: Database;

beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
});

describe("Context Assembler", () => {
    test("returns empty message when no projects", async () => {
        const context = await assembleContext(db, "What did I work on today?");
        expect(context).toContain("No projects");
    });

    test("includes project activity in context", async () => {
        const p = upsertProject(db, "/home/user/myapp", "myapp");
        insertEvent(db, p.id, "file_create", "src/index.ts");
        insertEvent(db, p.id, "file_modify", "src/app.tsx");
        insertEvent(db, p.id, "file_delete", "src/old.ts");

        const context = await assembleContext(db, "What did I do today?");
        expect(context).toContain("myapp");
        expect(context).toContain("1 created");
        expect(context).toContain("1 modified");
        expect(context).toContain("1 deleted");
    });

    test("includes git info in context", async () => {
        const p = upsertProject(db, "/home/user/myapp", "myapp");
        insertGitSnapshot(
            db,
            p.id,
            "feature/auth",
            "abc123",
            "add login page",
            nowIso(),
            2,
            ["auth.ts", "login.tsx"],
        );

        const context = await assembleContext(db, "Tell me about my work");
        expect(context).toContain("feature/auth");
        expect(context).toContain("add login page");
        expect(context).toContain("2 files");
    });

    test("stays under token budget", async () => {
        // Create many projects with lots of events
        for (let i = 0; i < 20; i++) {
            const p = upsertProject(
                db,
                `/home/user/project-${i}`,
                `project-${i}`,
            );
            for (let j = 0; j < 50; j++) {
                insertEvent(db, p.id, "file_modify", `src/file-${j}.ts`);
            }
        }

        const context = await assembleContext(db, "What did I do?");
        // ~4000 tokens ≈ 16000 chars
        expect(context.length).toBeLessThan(16000);
    });

    test("parses 'today' time range", async () => {
        const p = upsertProject(db, "/home/user/app", "app");
        insertEvent(db, p.id, "file_modify", "x.ts");

        const context = await assembleContext(db, "What did I do today?");
        expect(context).toContain("Today");
    });

    test("parses 'this week' time range", async () => {
        const p = upsertProject(db, "/home/user/app", "app");
        insertEvent(db, p.id, "file_modify", "x.ts");

        const context = await assembleContext(
            db,
            "Summarize my work this week",
        );
        expect(context).toContain("This week");
    });

    test("parses 'last N days' time range", async () => {
        const p = upsertProject(db, "/home/user/app", "app");
        insertEvent(db, p.id, "file_modify", "x.ts");

        const context = await assembleContext(
            db,
            "What did I do in the last 7 days?",
        );
        expect(context).toContain("Last 7 days");
    });

    test("defaults to last 24 hours", async () => {
        const p = upsertProject(db, "/home/user/app", "app");
        insertEvent(db, p.id, "file_modify", "x.ts");

        const context = await assembleContext(db, "What am I working on?");
        expect(context).toContain("Last 24 hours");
    });
});
