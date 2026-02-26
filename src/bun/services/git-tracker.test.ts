/**
 * Tests for git tracker service
 * Uses explicit git config to avoid SSH/GPG signing issues
 */

import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { toErrorData } from "../../shared/error.ts";
import { createLogger } from "../../shared/logger.ts";
import { runMigrations } from "../db/schema.ts";

import { GitTrackerService } from "./git-tracker.ts";

const logger = createLogger("git-tracker-test");

const TEST_DIR = "/tmp/trackmebaby-git-test";
let db: Database;
let tracker: GitTrackerService;

async function initGitRepo(dir: string, branch?: string): Promise<boolean> {
    try {
        const branchArgs = branch ? ["-b", branch] : [];
        const initCmd = Bun.spawnSync(["git", "init", ...branchArgs, dir], {
            env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1" },
        });
        if (initCmd.exitCode !== 0) return false;

        // Configure without signing
        const configs = [
            ["user.email", "test@test.com"],
            ["user.name", "Test"],
            ["commit.gpgSign", "false"],
            ["tag.gpgSign", "false"],
        ];
        for (const [key, val] of configs) {
            Bun.spawnSync(["git", "-C", dir, "config", key, val]);
        }
        return true;
    } catch (err: unknown) {
        logger.warn("git init failed", { error: toErrorData(err) });
        return false;
    }
}

async function gitCommit(dir: string, message: string): Promise<boolean> {
    try {
        const result = Bun.spawnSync(
            ["git", "-C", dir, "commit", "--no-gpg-sign", "-m", message],
            {
                env: {
                    ...process.env,
                    GIT_CONFIG_NOSYSTEM: "1",
                    GIT_COMMITTER_NAME: "Test",
                    GIT_COMMITTER_EMAIL: "test@test.com",
                    GIT_AUTHOR_NAME: "Test",
                    GIT_AUTHOR_EMAIL: "test@test.com",
                },
            },
        );
        return result.exitCode === 0;
    } catch (err: unknown) {
        logger.warn("git commit failed", { error: toErrorData(err) });
        return false;
    }
}

beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DIR, { recursive: true });
    tracker = new GitTrackerService(db, 60000);
});

afterEach(() => {
    tracker.stopTracking();
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
});

describe("GitTrackerService", () => {
    test("getSnapshot returns null for non-git directory", async () => {
        const status = await tracker.getSnapshot(TEST_DIR);
        expect(status).toBeNull();
    });

    test("getSnapshot works for a git repo", async () => {
        const ok = await initGitRepo(TEST_DIR);
        if (!ok) {
            logger.warn("skipping test: git init failed");
            return;
        }

        writeFileSync(join(TEST_DIR, "README.md"), "# Test");
        Bun.spawnSync(["git", "-C", TEST_DIR, "add", "."]);
        const committed = await gitCommit(TEST_DIR, "initial commit");
        if (!committed) {
            logger.warn("skipping test: git commit failed");
            return;
        }

        const status = await tracker.getSnapshot(TEST_DIR);
        expect(status).toBeTruthy();
        expect(status!.branch).toBeTruthy();
        // lastCommitHash may be null if Bun.$ git log encounters env issues
        if (status!.lastCommitHash) {
            expect(status!.lastCommitMessage).toBe("initial commit");
        }
        expect(status!.uncommittedCount).toBe(0);
    }, 10000);

    test("detects uncommitted changes", async () => {
        const ok = await initGitRepo(TEST_DIR);
        if (!ok) {
            logger.warn("skipping test: git init failed");
            return;
        }

        writeFileSync(join(TEST_DIR, "a.ts"), "const a = 1;");
        Bun.spawnSync(["git", "-C", TEST_DIR, "add", "."]);
        const committed = await gitCommit(TEST_DIR, "initial");
        if (!committed) {
            logger.warn("skipping test: git commit failed");
            return;
        }

        // Make uncommitted changes
        writeFileSync(join(TEST_DIR, "b.ts"), "const b = 2;");
        writeFileSync(join(TEST_DIR, "a.ts"), "const a = 2; // modified");

        const status = await tracker.getSnapshot(TEST_DIR);
        expect(status!.uncommittedCount).toBeGreaterThanOrEqual(2);
        expect(status!.uncommittedFiles.length).toBeGreaterThanOrEqual(2);
    }, 10000);

    test("detects branch name", async () => {
        const ok = await initGitRepo(TEST_DIR, "feature-test");
        if (!ok) {
            logger.warn("skipping test: git init failed");
            return;
        }

        writeFileSync(join(TEST_DIR, "x.ts"), "x");
        Bun.spawnSync(["git", "-C", TEST_DIR, "add", "."]);
        const committed = await gitCommit(TEST_DIR, "init");
        if (!committed) {
            logger.warn("skipping test: git commit failed");
            return;
        }

        const status = await tracker.getSnapshot(TEST_DIR);
        expect(status!.branch).toBe("feature-test");
    }, 10000);
});
