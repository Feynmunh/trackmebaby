/**
 * Tests for AI context assembler
 */

import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nowIso } from "../../../shared/time.ts";
import type { AIQueryOptions } from "../../../shared/types.ts";
import {
    insertEvent,
    insertGitSnapshot,
    upsertProject,
} from "../../db/queries.ts";
import { runMigrations } from "../../db/schema.ts";
import { assembleContext } from "./context-assembler.ts";

let db: Database;
let tempRoot: string;

beforeEach(async () => {
    db = new Database(":memory:");
    runMigrations(db);
    tempRoot = join(tmpdir(), `trackmebaby-context-${randomUUID()}`);
    await mkdir(tempRoot, { recursive: true });
});

afterEach(async () => {
    db.close();
    await rm(tempRoot, { recursive: true, force: true });
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

    test("file_summary returns error when options missing", async () => {
        const options: AIQueryOptions = { task: "file_summary" };
        const context = await assembleContext(db, "", options);
        expect(context).toContain("No file context available");
    });

    test("file_summary returns error for unknown project", async () => {
        const options: AIQueryOptions = {
            task: "file_summary",
            projectId: "missing",
            filePath: "src/index.ts",
        };
        const context = await assembleContext(db, "", options);
        expect(context).toContain("Project not found");
    });

    test("file_summary includes file content for new files", async () => {
        const project = upsertProject(db, tempRoot, "temp-project");
        const filePath = "src/new.ts";
        const absolutePath = join(tempRoot, filePath);
        await mkdir(join(tempRoot, "src"), { recursive: true });
        await writeFile(absolutePath, "export const value = 1;\n");

        const options: AIQueryOptions = {
            task: "file_summary",
            projectId: project.id,
            filePath,
            fileType: "created",
        };
        const context = await assembleContext(db, "", options);
        expect(context).toContain("[FILE_CONTENT]");
        expect(context).toContain("export const value");
    });

    test("file_summary includes diff for modified files", async () => {
        const project = upsertProject(db, tempRoot, "temp-project");
        const filePath = "src/modified.ts";
        await mkdir(join(tempRoot, "src"), { recursive: true });
        await writeFile(join(tempRoot, filePath), "export const value = 2;\n");

        const options: AIQueryOptions = {
            task: "file_summary",
            projectId: project.id,
            filePath,
            fileType: "modified",
        };
        const context = await assembleContext(db, "", options);
        expect(context).toContain("[FILE_CONTENT]");
    });

    test("file_summary includes diff for deleted files", async () => {
        const project = upsertProject(db, tempRoot, "temp-project");
        const options: AIQueryOptions = {
            task: "file_summary",
            projectId: project.id,
            filePath: "src/deleted.ts",
            fileType: "deleted",
        };
        const context = await assembleContext(db, "", options);
        expect(context).not.toContain("[FILE_CONTENT]");
    });

    test("file_summary rejects path traversal", async () => {
        const project = upsertProject(db, tempRoot, "temp-project");
        const options: AIQueryOptions = {
            task: "file_summary",
            projectId: project.id,
            filePath: "../secrets.txt",
            fileType: "modified",
        };
        const context = await assembleContext(db, "", options);
        expect(context).toContain("[NO_CONTENT_AVAILABLE]");
    });
});
