/**
 * Git Tracking Service — polls git repos for status changes
 * Uses Bun.$ shell for all git operations (no simple-git)
 * Read-only: never modifies the user's git state
 */

import type { Database } from "bun:sqlite";
import { toErrorData } from "../../shared/error.ts";
import { createLogger } from "../../shared/logger.ts";
import { nowIso } from "../../shared/time.ts";
import type {
    GitSnapshot,
    ProjectStats,
    RecentCommit,
} from "../../shared/types.ts";
import {
    getLatestGitSnapshot,
    getProjectByPath,
    insertGitSnapshot,
} from "../db/queries.ts";
import { runGit, runGitLines } from "./git-command.ts";
import { getUncommittedFileStatus } from "./git-utils.ts";

export interface GitStatus {
    branch: string;
    lastCommitHash: string | null;
    lastCommitMessage: string | null;
    lastCommitTimestamp: string | null;
    uncommittedCount: number;
    uncommittedFiles: string[];
    diffStats: string | null;
    activityTimestamp: string;
}

type GitStatusCallback = (projectPath: string, snapshot: GitSnapshot) => void;

export class GitTrackerService {
    private pollTimers: Map<string, Timer> = new Map();
    private pollIntervalMs: number;
    private db: Database;
    private callbacks: GitStatusCallback[] = [];
    private running = false;
    private logger = createLogger("git-tracker");

    constructor(db: Database, pollIntervalMs: number = 60000) {
        this.db = db;
        this.pollIntervalMs = Math.max(30000, pollIntervalMs); // min 30s
    }

    /**
     * Register a callback for git status changes.
     */
    onStatusChange(callback: GitStatusCallback): void {
        this.callbacks.push(callback);
    }

    /**
     * Start tracking a list of project paths.
     */
    async startTracking(projectPaths: string[]): Promise<void> {
        this.running = true;

        const gitVersion = await runGit(["--version"], {
            label: "GitTracker",
            logLevel: "error",
        });
        if (!gitVersion) {
            this.logger.error("git is not installed or not in PATH");
            return;
        }

        for (const path of projectPaths) {
            this.trackProject(path);
        }
    }

    /**
     * Start tracking a single project.
     */
    trackProject(projectPath: string): void {
        if (this.pollTimers.has(projectPath)) return;

        // Do an initial snapshot immediately
        this.pollProject(projectPath);

        // Set up polling interval
        const timer = setInterval(() => {
            if (this.running) {
                this.pollProject(projectPath);
            }
        }, this.pollIntervalMs);

        this.pollTimers.set(projectPath, timer);
        this.logger.info("tracking started", {
            projectPath,
            intervalSeconds: this.pollIntervalMs / 1000,
        });
    }

    /**
     * Stop tracking a project.
     */
    untrackProject(projectPath: string): void {
        const timer = this.pollTimers.get(projectPath);
        if (timer) {
            clearInterval(timer);
            this.pollTimers.delete(projectPath);
        }
    }

    /**
     * Stop all tracking.
     */
    stopTracking(): void {
        this.running = false;
        for (const [, timer] of this.pollTimers) {
            clearInterval(timer);
        }
        this.pollTimers.clear();
    }

    /**
     * Get a git snapshot for a project (one-shot, no persistence).
     */
    async getSnapshot(projectPath: string): Promise<GitStatus | null> {
        try {
            return await this.fetchGitStatus(projectPath);
        } catch (err: unknown) {
            this.logger.error("error getting snapshot", {
                projectPath,
                error: toErrorData(err),
            });
            return null;
        }
    }

    async getProjectStats(projectPath: string): Promise<ProjectStats | null> {
        try {
            // Verify it's a git repo
            const isRepo = await runGit(["rev-parse", "--git-dir"], {
                projectPath,
                label: "GitTracker",
                logOnError: false,
            });
            if (!isRepo) {
                this.logger.warn("not a git repo for stats", { projectPath });
                return null;
            }

            // Branch count & names
            let branchCount = 0;
            let branches: string[] = [];
            try {
                const branchLines = await runGitLines(["branch", "--list"], {
                    projectPath,
                    label: "GitTracker",
                });
                branchCount = branchLines.length;
                branches = branchLines.map((line) =>
                    line.replace(/^\*?\s+/, "").trim(),
                );
            } catch (err: unknown) {
                this.logger.warn("failed to read branches", {
                    projectPath,
                    error: toErrorData(err),
                });
            }

            // Total commits
            let totalCommits = 0;
            try {
                const output = await runGit(["rev-list", "--count", "HEAD"], {
                    projectPath,
                    label: "GitTracker",
                });
                totalCommits = output ? parseInt(output, 10) || 0 : 0;
            } catch (err: unknown) {
                this.logger.warn("failed to read commit count", {
                    projectPath,
                    error: toErrorData(err),
                });
            }

            // Repo age (first commit)
            let repoAgeFirstCommit: string | null = null;
            try {
                const lines = await runGitLines(
                    ["log", "--reverse", "--format=%aI"],
                    {
                        projectPath,
                        label: "GitTracker",
                    },
                );
                repoAgeFirstCommit = lines[0] || null;
            } catch (err: unknown) {
                this.logger.warn("failed to read repo age", {
                    projectPath,
                    error: toErrorData(err),
                });
            }

            // Last 25 commits with stats
            const recentCommits: RecentCommit[] = [];
            try {
                const lines = await runGitLines(
                    [
                        "log",
                        "-25",
                        "-m",
                        "--format===%H|%s|%aI|%an",
                        "--numstat",
                    ],
                    { projectPath, label: "GitTracker" },
                );

                let currentCommit: RecentCommit | null = null;
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;

                    if (trimmed.startsWith("===")) {
                        if (currentCommit) recentCommits.push(currentCommit);

                        const [hashAndPrefix, message, timestamp, author] =
                            trimmed.split("|");
                        const hash = hashAndPrefix.replace("===", "");
                        currentCommit = {
                            hash,
                            message,
                            timestamp,
                            author,
                            insertions: 0,
                            deletions: 0,
                        };
                    } else if (currentCommit) {
                        const parts = trimmed.split(/\s+/);
                        if (parts.length >= 2) {
                            const ins = parseInt(parts[0], 10);
                            const del = parseInt(parts[1], 10);
                            if (!Number.isNaN(ins))
                                currentCommit.insertions += ins;
                            if (!Number.isNaN(del))
                                currentCommit.deletions += del;
                        }
                    }
                }
                if (currentCommit) recentCommits.push(currentCommit);
            } catch (err: unknown) {
                this.logger.error("error fetching recent commits", {
                    projectPath,
                    error: toErrorData(err),
                });
            }

            // Diff summary
            let diffSummary: ProjectStats["diffSummary"] = null;
            try {
                const output = await runGit(["diff", "--shortstat"], {
                    projectPath,
                    label: "GitTracker",
                });
                // Example: 2 files changed, 10 insertions(+), 5 deletions(-)
                if (output) {
                    const filesMatch = output.match(/(\d+) files? changed/);
                    const insMatch = output.match(/(\d+) insertions?\(\+\)/);
                    const delMatch = output.match(/(\d+) deletions?\(-\)/);
                    diffSummary = {
                        filesChanged: filesMatch
                            ? parseInt(filesMatch[1], 10)
                            : 0,
                        insertions: insMatch ? parseInt(insMatch[1], 10) : 0,
                        deletions: delMatch ? parseInt(delMatch[1], 10) : 0,
                    };
                }
            } catch (err: unknown) {
                this.logger.warn("failed to read diff summary", {
                    projectPath,
                    error: toErrorData(err),
                });
            }

            // Top contributors
            let contributors: { name: string; commits: number }[] = [];
            try {
                contributors = (
                    await runGitLines(["shortlog", "-sn", "--no-merges"], {
                        projectPath,
                        label: "GitTracker",
                    })
                )
                    .slice(0, 3)
                    .map((line) => {
                        const match = line.trim().match(/^(\d+)\s+(.+)$/);
                        return {
                            name: match ? match[2] : "Unknown",
                            commits: match ? parseInt(match[1], 10) : 0,
                        };
                    });
            } catch (err: unknown) {
                this.logger.warn("failed to read contributors", {
                    projectPath,
                    error: toErrorData(err),
                });
            }

            return {
                branchCount,
                branches,
                totalCommits,
                repoAgeFirstCommit,
                recentCommits,
                diffSummary,
                contributors,
            };
        } catch (err: unknown) {
            this.logger.error("error getting stats", {
                projectPath,
                error: toErrorData(err),
            });
            return null;
        }
    }

    private async pollProject(projectPath: string): Promise<void> {
        try {
            const status = await this.fetchGitStatus(projectPath);
            if (!status) return;

            // Check if anything changed from last snapshot
            const project = getProjectByPath(this.db, projectPath);
            if (!project) return;

            const lastSnapshot = getLatestGitSnapshot(this.db, project.id);
            if (lastSnapshot && !this.hasChanged(lastSnapshot, status)) {
                return; // No changes — skip storing
            }

            const snapshot = insertGitSnapshot(
                this.db,
                project.id,
                status.branch,
                status.lastCommitHash,
                status.lastCommitMessage,
                status.lastCommitTimestamp,
                status.uncommittedCount,
                status.uncommittedFiles,
                status.diffStats ?? undefined,
            );

            // Correct the project's last_activity_at using our derived source-of-truth
            this.db
                .query("UPDATE projects SET last_activity_at = ? WHERE id = ?")
                .run(status.activityTimestamp, project.id);

            // Notify callbacks
            for (const cb of this.callbacks) {
                try {
                    cb(projectPath, snapshot);
                } catch (err: unknown) {
                    this.logger.error("callback error", {
                        projectPath,
                        error: toErrorData(err),
                    });
                }
            }
        } catch (err: unknown) {
            this.logger.error("poll error", {
                projectPath,
                error: toErrorData(err),
            });
        }
    }

    private async fetchGitStatus(
        projectPath: string,
    ): Promise<GitStatus | null> {
        // Verify it's a git repo
        const isRepo = await runGit(["rev-parse", "--git-dir"], {
            projectPath,
            label: "GitTracker",
            logOnError: false,
        });
        if (!isRepo) {
            this.logger.warn("not a git repo", { projectPath });
            return null;
        }

        // Get current branch
        let branch = "unknown";
        try {
            const output = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], {
                projectPath,
                label: "GitTracker",
            });
            if (output) branch = output;
        } catch (err: unknown) {
            this.logger.warn("failed to read branch", {
                projectPath,
                error: toErrorData(err),
            });
        }

        // Get last commit info
        let lastCommitHash: string | null = null;
        let lastCommitMessage: string | null = null;
        let lastCommitTimestamp: string | null = null;
        try {
            const output = await runGit(["log", "-1", "--format=%H|%s|%aI"], {
                projectPath,
                label: "GitTracker",
            });
            const parts = output ? output.split("|") : [];
            if (parts.length >= 3) {
                lastCommitHash = parts[0];
                lastCommitMessage = parts[1];
                lastCommitTimestamp = parts.slice(2).join("|"); // ISO date may contain |
            }
        } catch (err: unknown) {
            this.logger.warn("failed to read last commit", {
                projectPath,
                error: toErrorData(err),
            });
        }

        let diffStats: string | null = null;
        const { uncommittedFiles, latestMtime, fileMtimes } =
            await getUncommittedFileStatus(projectPath, "GitTracker");

        if (uncommittedFiles.length > 0) {
            const fileDiffs = new Map<
                string,
                { insertions: number; deletions: number }
            >();
            try {
                const diffLines = await runGitLines(
                    ["diff", "HEAD", "--numstat"],
                    { projectPath, label: "GitTracker" },
                );
                for (const line of diffLines) {
                    const [insRaw, delRaw, pathRaw] = line.split("\t");
                    if (!pathRaw) continue;
                    const insertions = parseInt(insRaw, 10) || 0;
                    const deletions = parseInt(delRaw, 10) || 0;
                    fileDiffs.set(pathRaw, { insertions, deletions });
                }
            } catch (err: unknown) {
                this.logger.warn("failed to read diff stats", {
                    projectPath,
                    error: toErrorData(err),
                });
            }

            const fileStats: Record<
                string,
                { insertions: number; deletions: number; mtime?: string }
            > = {};
            for (const file of uncommittedFiles) {
                const diff = fileDiffs.get(file) ?? {
                    insertions: 0,
                    deletions: 0,
                };
                fileStats[file] = {
                    insertions: diff.insertions,
                    deletions: diff.deletions,
                    mtime: fileMtimes.get(file),
                };
            }
            diffStats = JSON.stringify(fileStats);
        }

        // Derive true activity: mtime of unsaved files OR last commit time
        const activityTimestamp = latestMtime
            ? latestMtime.toISOString()
            : lastCommitTimestamp || nowIso();

        return {
            branch,
            lastCommitHash,
            lastCommitMessage,
            lastCommitTimestamp,
            uncommittedCount: uncommittedFiles.length,
            uncommittedFiles,
            diffStats,
            activityTimestamp,
        };
    }

    private hasChanged(last: GitSnapshot, current: GitStatus): boolean {
        return (
            last.branch !== current.branch ||
            last.lastCommitHash !== current.lastCommitHash ||
            last.uncommittedCount !== current.uncommittedCount ||
            JSON.stringify(last.uncommittedFiles) !==
                JSON.stringify(current.uncommittedFiles)
        );
    }
}
