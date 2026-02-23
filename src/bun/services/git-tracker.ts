/**
 * Git Tracking Service — polls git repos for status changes
 * Uses Bun.$ shell for all git operations (no simple-git)
 * Read-only: never modifies the user's git state
 */
import type { Database } from "bun:sqlite";
import {
    insertGitSnapshot,
    getLatestGitSnapshot,
    getProjectByPath,
} from "../db/queries.ts";
import type { GitSnapshot } from "../../shared/types.ts";

export interface GitStatus {
    branch: string;
    lastCommitHash: string | null;
    lastCommitMessage: string | null;
    lastCommitTimestamp: string | null;
    uncommittedCount: number;
    uncommittedFiles: string[];
    diffStats: string | null;
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

            // Store new snapshot
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
            const result = await Bun.$`git -C ${projectPath} log -1 --format=%H|%s|%aI`.quiet();
            const parts = result.text().trim().split("|");
            if (parts.length >= 3) {
                lastCommitHash = parts[0];
                lastCommitMessage = parts[1];
                lastCommitTimestamp = parts.slice(2).join("|"); // ISO date may contain |
            }
        } catch {
            // No commits yet
        }

        // Get uncommitted files
        let uncommittedFiles: string[] = [];
        try {
            const result = await Bun.$`git -C ${projectPath} status --porcelain`.quiet();
            const output = result.text().trim();
            if (output) {
                uncommittedFiles = output
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((line) => line.substring(3)); // Strip status prefix (e.g., "M  ", "?? ")
            }
        } catch { }

        // Get diff stats
        let diffStats: string | null = null;
        try {
            const result = await Bun.$`git -C ${projectPath} diff --stat`.quiet();
            const output = result.text().trim();
            if (output) {
                diffStats = output;
            }
        } catch { }

        return {
            branch,
            lastCommitHash,
            lastCommitMessage,
            lastCommitTimestamp,
            uncommittedCount: uncommittedFiles.length,
            uncommittedFiles,
            diffStats,
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
