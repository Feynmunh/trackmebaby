/**
 * Git Tracking Service — polls git repos for status changes
 * Uses Bun.$ shell for all git operations (no simple-git)
 * Read-only: never modifies the user's git state
 */
import { join } from "node:path";
import type { Database } from "bun:sqlite";
import {
    insertGitSnapshot,
    getLatestGitSnapshot,
    getProjectByPath,
} from "../db/queries.ts";
import type { GitSnapshot, ProjectStats, RecentCommit } from "../../shared/types.ts";

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

        // Validate git is installed
        try {
            await Bun.$`git --version`.quiet();
        } catch {
            console.error("[GitTracker] git is not installed or not in PATH");
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
        console.log(`[GitTracker] Tracking: ${projectPath} (${this.pollIntervalMs / 1000}s interval)`);
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
        } catch (err: any) {
            console.error(`[GitTracker] Error getting snapshot for ${projectPath}:`, err.message);
            return null;
        }
    }

    async getProjectStats(projectPath: string): Promise<ProjectStats | null> {
        try {
            // Verify it's a git repo
            try {
                await Bun.$`git -C ${projectPath} rev-parse --git-dir`.quiet();
            } catch {
                return null;
            }

            // Branch count & names
            let branchCount = 0;
            let branches: string[] = [];
            try {
                const result = await Bun.$`git -C ${projectPath} branch --list`.quiet();
                const branchLines = result.text().trim().split("\n").filter(Boolean);
                branchCount = branchLines.length;
                branches = branchLines.map(line => line.replace(/^\*?\s+/, "").trim());
            } catch { }

            // Total commits
            let totalCommits = 0;
            try {
                const result = await Bun.$`git -C ${projectPath} rev-list --count HEAD`.quiet();
                totalCommits = parseInt(result.text().trim()) || 0;
            } catch { }

            // Repo age (first commit)
            let repoAgeFirstCommit: string | null = null;
            try {
                const result = await Bun.$`git -C ${projectPath} log --reverse --format=%aI`.quiet();
                repoAgeFirstCommit = result.text().split("\n")[0]?.trim() || null;
            } catch { }

            // Last 25 commits with stats
            let recentCommits: RecentCommit[] = [];
            try {
                // We use --shortstat to get additions/deletions. 
                // Note: Merge commits might not show stats unless we add -m/--cc, but usually we want clean stats.
                const result = await Bun.$`git -C ${projectPath} log -25 -m --format="===%H|%s|%aI|%an" --numstat`.quiet();
                const lines = result.text().trim().split("\n");

                let currentCommit: RecentCommit | null = null;
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;

                    if (trimmed.startsWith("===")) {
                        if (currentCommit) recentCommits.push(currentCommit);

                        const [hashAndPrefix, message, timestamp, author] = trimmed.split("|");
                        const hash = hashAndPrefix.replace("===", "");
                        currentCommit = { hash, message, timestamp, author, insertions: 0, deletions: 0 };
                    } else if (currentCommit) {
                        const parts = trimmed.split(/\s+/);
                        if (parts.length >= 2) {
                            const ins = parseInt(parts[0]);
                            const del = parseInt(parts[1]);
                            if (!isNaN(ins)) currentCommit.insertions += ins;
                            if (!isNaN(del)) currentCommit.deletions += del;
                        }
                    }
                }
                if (currentCommit) recentCommits.push(currentCommit);
            } catch (err: any) {
                console.error(`[GitTracker] Error fetching recent commits:`, err.message);
            }

            // Diff summary
            let diffSummary: ProjectStats['diffSummary'] = null;
            try {
                const result = await Bun.$`git -C ${projectPath} diff --shortstat`.quiet();
                const output = result.text().trim();
                // Example: 2 files changed, 10 insertions(+), 5 deletions(-)
                if (output) {
                    const filesMatch = output.match(/(\d+) files? changed/);
                    const insMatch = output.match(/(\d+) insertions?\(\+\)/);
                    const delMatch = output.match(/(\d+) deletions?\(-\)/);
                    diffSummary = {
                        filesChanged: filesMatch ? parseInt(filesMatch[1]) : 0,
                        insertions: insMatch ? parseInt(insMatch[1]) : 0,
                        deletions: delMatch ? parseInt(delMatch[1]) : 0
                    };
                }
            } catch { }

            // Top contributors
            let contributors: { name: string; commits: number }[] = [];
            try {
                const result = await Bun.$`git -C ${projectPath} shortlog -sn --no-merges`.quiet();
                contributors = result.text().trim().split("\n").filter(Boolean).slice(0, 3).map(line => {
                    const match = line.trim().match(/^(\d+)\s+(.+)$/);
                    return {
                        name: match ? match[2] : "Unknown",
                        commits: match ? parseInt(match[1]) : 0
                    };
                });
            } catch { }

            return {
                branchCount,
                branches,
                totalCommits,
                repoAgeFirstCommit,
                recentCommits,
                diffSummary,
                contributors
            };
        } catch (err: any) {
            console.error(`[GitTracker] Error getting stats for ${projectPath}:`, err.message);
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
                status.diffStats ?? undefined
            );

            // Correct the project's last_activity_at using our derived source-of-truth
            this.db.query("UPDATE projects SET last_activity_at = ? WHERE id = ?").run(status.activityTimestamp, project.id);

            // Notify callbacks
            for (const cb of this.callbacks) {
                try {
                    cb(projectPath, snapshot);
                } catch (err: any) {
                    console.error(`[GitTracker] Callback error:`, err.message);
                }
            }
        } catch (err: any) {
            console.error(`[GitTracker] Poll error for ${projectPath}:`, err.message);
        }
    }

    private async fetchGitStatus(projectPath: string): Promise<GitStatus | null> {
        // Verify it's a git repo
        try {
            await Bun.$`git -C ${projectPath} rev-parse --git-dir`.quiet();
        } catch {
            return null; // Not a git repo
        }

        // Get current branch
        let branch = "unknown";
        try {
            const result = await Bun.$`git -C ${projectPath} rev-parse --abbrev-ref HEAD`.quiet();
            branch = result.text().trim();
        } catch { }

        // Get last commit info
        let lastCommitHash: string | null = null;
        let lastCommitMessage: string | null = null;
        let lastCommitTimestamp: string | null = null;
        try {
            const result = await Bun.$`git -C ${projectPath} log -1 --format="%H|%s|%aI"`.quiet();
            const parts = result.text().trim().split("|");
            if (parts.length >= 3) {
                lastCommitHash = parts[0];
                lastCommitMessage = parts[1];
                lastCommitTimestamp = parts.slice(2).join("|"); // ISO date may contain |
            }
        } catch {
            // No commits yet
        }

        let uncommittedFiles: string[] = [];
        let latestMtime: Date | null = null;
        let diffStats: string | null = null;
        try {
            const result = await Bun.$`git -C ${projectPath} status --porcelain`.quiet();
            const output = result.text().trim();
            if (output) {
                uncommittedFiles = output
                    .split("\n")
                    .filter(Boolean)
                    .map((line) => {
                        if (line.length <= 3) return "";
                        const pathPart = line.slice(3).trim();
                        if (!pathPart) return "";
                        if (pathPart.includes(" -> ")) {
                            return pathPart.split(" -> ").pop() ?? "";
                        }
                        return pathPart;
                    })
                    .filter(Boolean);

                const fileMtimes = new Map<string, string>();
                const { statSync } = require("node:fs");
                for (const file of uncommittedFiles) {
                    try {
                        const fullPath = join(projectPath, file);
                        const stats = statSync(fullPath);
                        fileMtimes.set(file, stats.mtime.toISOString());
                        if (!latestMtime || stats.mtime > latestMtime) {
                            latestMtime = stats.mtime;
                        }
                    } catch (err) {
                        // File may be deleted or permission denied - skip
                    }
                }

                const fileDiffs = new Map<string, { insertions: number; deletions: number }>();
                try {
                    const diffResult = await Bun.$`git -C ${projectPath} diff HEAD --numstat`.quiet();
                    const diffLines = diffResult.text().trim().split("\n").filter(Boolean);
                    for (const line of diffLines) {
                        const [insRaw, delRaw, pathRaw] = line.split("\t");
                        if (!pathRaw) continue;
                        const insertions = parseInt(insRaw) || 0;
                        const deletions = parseInt(delRaw) || 0;
                        fileDiffs.set(pathRaw, { insertions, deletions });
                    }
                } catch (err) {
                    // Git diff may fail if no changes or git error - continue with empty stats
                }

                const fileStats: Record<string, { insertions: number; deletions: number; mtime?: string }> = {};
                for (const file of uncommittedFiles) {
                    const diff = fileDiffs.get(file) ?? { insertions: 0, deletions: 0 };
                    fileStats[file] = {
                        insertions: diff.insertions,
                        deletions: diff.deletions,
                        mtime: fileMtimes.get(file),
                    };
                }
                diffStats = JSON.stringify(fileStats);
            }
        } catch (err) {
            // Git status may fail - continue with empty data
        }

        

        // Derive true activity: mtime of unsaved files OR last commit time
        const activityTimestamp = latestMtime ? latestMtime.toISOString() : (lastCommitTimestamp || new Date().toISOString());

        return {
            branch,
            lastCommitHash,
            lastCommitMessage,
            lastCommitTimestamp,
            uncommittedCount: uncommittedFiles.length,
            uncommittedFiles,
            diffStats,
            activityTimestamp
        };
    }

    private hasChanged(last: GitSnapshot, current: GitStatus): boolean {
        return (
            last.branch !== current.branch ||
            last.lastCommitHash !== current.lastCommitHash ||
            last.uncommittedCount !== current.uncommittedCount ||
            JSON.stringify(last.uncommittedFiles) !== JSON.stringify(current.uncommittedFiles)
        );
    }
}
