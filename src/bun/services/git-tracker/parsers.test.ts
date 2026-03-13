import { describe, expect, test } from "bun:test";
import {
    COMMIT_MARKER,
    parseBranches,
    parseDiffStat,
    parseGitLog,
} from "./parsers.ts";

describe("parseGitLog", () => {
    test("returns empty array for empty output", () => {
        expect(parseGitLog("")).toEqual([]);
    });

    test("parses commit headers and accumulates stats", () => {
        const output = [
            `${COMMIT_MARKER}abc123|fix parser|2026-01-01T00:00:00.000Z|alex`,
            "3 1 src/a.ts",
            "2 0 src/b.ts",
            `${COMMIT_MARKER}def456|feat: add path with | pipe|2026-01-02T00:00:00.000Z|sam`,
            "1 4 src/c.ts",
        ].join("\n");

        const commits = parseGitLog(output);
        expect(commits).toHaveLength(2);
        expect(commits[0]).toEqual({
            hash: "abc123",
            message: "fix parser",
            timestamp: "2026-01-01T00:00:00.000Z",
            author: "alex",
            insertions: 5,
            deletions: 1,
        });
        expect(commits[1]).toEqual({
            hash: "def456",
            message: "feat: add path with | pipe",
            timestamp: "2026-01-02T00:00:00.000Z",
            author: "sam",
            insertions: 1,
            deletions: 4,
        });
    });

    test("ignores malformed stat lines", () => {
        const output = [
            `${COMMIT_MARKER}aaa|msg|2026-01-01T00:00:00.000Z|me`,
            "- - binary.file",
            "7 nope src/file.ts",
        ].join("\n");

        const commits = parseGitLog(output);
        expect(commits).toHaveLength(1);
        expect(commits[0].insertions).toBe(7);
        expect(commits[0].deletions).toBe(0);
    });
});

describe("parseDiffStat", () => {
    test("extracts files changed, insertions, and deletions", () => {
        const parsed = parseDiffStat(
            "3 files changed, 20 insertions(+), 4 deletions(-)",
        );
        expect(parsed).toEqual({
            filesChanged: 3,
            insertions: 20,
            deletions: 4,
        });
    });

    test("defaults to zero when fields are missing", () => {
        const parsed = parseDiffStat("0 files changed");
        expect(parsed).toEqual({
            filesChanged: 0,
            insertions: 0,
            deletions: 0,
        });
    });
});

describe("parseBranches", () => {
    test("returns cleaned branch names", () => {
        const output = "* main\n  feature/alpha\n\n  release\n";
        expect(parseBranches(output)).toEqual([
            "main",
            "feature/alpha",
            "release",
        ]);
    });

    test("returns empty array for blank output", () => {
        expect(parseBranches("   \n\n")).toEqual([]);
    });
});
