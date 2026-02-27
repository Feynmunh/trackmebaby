import { runGit, runGitLines } from "../git-command.ts";
import type { Contributor, DiffSummary, ParsedCommit } from "./parsers.ts";
import {
    COMMIT_MARKER,
    parseBranches,
    parseContributors,
    parseDiffStat,
    parseGitLog,
} from "./parsers.ts";

export async function getRecentCommits(
    projectPath: string,
): Promise<ParsedCommit[]> {
    const format = `${COMMIT_MARKER}%H|%s|%aI|%an`;
    const lines = await runGitLines(
        ["log", "-25", "-m", `--format=${format}`, "--numstat"],
        { projectPath, label: "GitTracker", timeoutMs: 8000 },
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

export async function getContributors(
    projectPath: string,
): Promise<Contributor[]> {
    const lines = await runGitLines(["shortlog", "-sn", "--no-merges"], {
        projectPath,
        label: "GitTracker",
        timeoutMs: 8000,
    });
    return parseContributors(lines.join("\n")).slice(0, 3);
}
