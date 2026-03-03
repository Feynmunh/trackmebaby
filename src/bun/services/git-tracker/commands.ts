import { runGit, runGitLines } from "../git-command.ts";
import type { DiffSummary, ParsedCommit } from "./parsers.ts";
import {
    COMMIT_MARKER,
    parseBranches,
    parseDiffStat,
    parseGitLog,
} from "./parsers.ts";

export async function getRecentCommits(
    projectPath: string,
): Promise<ParsedCommit[]> {
    const format = `${COMMIT_MARKER}%H|%s|%aI|%an`;
    const lines = await runGitLines(
        ["log", "-m", `--format=${format}`, "--numstat"],
        { projectPath, label: "GitTracker", timeoutMs: 15000 },
    );

    return parseGitLog(lines.join("\n"));
}

export async function getDiffStats(
    projectPath: string,
): Promise<DiffSummary | null> {
    const output = await runGit(["diff", "--shortstat"], {
        projectPath,
        label: "GitTracker",
        timeoutMs: 5000,
    });
    if (!output) return null;
    return parseDiffStat(output);
}

export async function getBranches(projectPath: string): Promise<string[]> {
    const lines = await runGitLines(["branch", "--list"], {
        projectPath,
        label: "GitTracker",
        timeoutMs: 5000,
    });
    return parseBranches(lines.join("\n"));
}
