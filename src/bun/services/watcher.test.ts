/**
 * Tests for file watcher service — lifecycle and filtering only
 * (Event detection tests are skipped in CI due to fs.watch timing sensitivity)
 */

import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { upsertProject } from "../db/queries.ts";
import { runMigrations } from "../db/schema.ts";
import { WatcherService } from "./watcher.ts";

const TEST_DIR = "/tmp/trackmebaby-watcher-test";
let db: Database;
let watcher: WatcherService;

beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DIR, { recursive: true });
    watcher = new WatcherService(db, 100);
});

afterEach(() => {
    watcher.stopAll();
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
});

describe("WatcherService", () => {
    test("addProject creates a watcher", async () => {
        upsertProject(db, TEST_DIR, "test");
        await watcher.addProject(TEST_DIR);
        expect(watcher.activeCount).toBe(1);
    });

    test("removeProject removes a watcher", async () => {
        upsertProject(db, TEST_DIR, "test");
        await watcher.addProject(TEST_DIR);
        watcher.removeProject(TEST_DIR);
        expect(watcher.activeCount).toBe(0);
    });

    test("stopAll clears all watchers", async () => {
        upsertProject(db, TEST_DIR, "test");
        await watcher.addProject(TEST_DIR);
        watcher.stopAll();
        expect(watcher.activeCount).toBe(0);
    });

    test("addProject is idempotent", async () => {
        upsertProject(db, TEST_DIR, "test");
        await watcher.addProject(TEST_DIR);
        await watcher.addProject(TEST_DIR);
        expect(watcher.activeCount).toBe(1);
    });

    test("removeProject on unwatched path is a no-op", () => {
        watcher.removeProject("/nonexistent");
        expect(watcher.activeCount).toBe(0);
    });
});
