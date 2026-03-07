/**
 * Project Scanner — auto-detect git repos in a base folder
 * Recursively scans for directories containing .git (max depth 3)
 * Detects git worktrees and groups them under the main repo
 * Read-only: never modifies git repos
 */

import type { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { toErrorData } from "../../shared/error.ts";
import { createLogger } from "../../shared/logger.ts";
import type { Project, Worktree } from "../../shared/types.ts";
import { clearDeletedProjectsUnder } from "../db/queries/projects.ts";
import { upsertProject } from "../db/queries.ts";
import { runGit } from "./git-command.ts";
import { getUncommittedFileStatus } from "./git-utils.ts";

const MAX_DEPTH = 3;

// Directories to never descend into
const SKIP_DIRS = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    ".cache",
    "__pycache__",
    ".venv",
    "venv",
    ".tox",
    "target", // Rust
    "vendor", // Go
    ".gradle",
    ".idea",
    ".vscode",
]);

export class ProjectScanner {
    private db: Database;
    private logger = createLogger("project-scanner");

    constructor(db: Database) {
        this.db = db;
    }

    /**
     * Scan a base folder for git repositories and register them as projects.
     * Returns the list of discovered projects.
     */
    async scan(basePath: string): Promise<Project[]> {
        if (!existsSync(basePath)) {
            this.logger.error("base path does not exist", { basePath });
            return [];
        }

        // Clear previously-deleted markers so re-scans restore projects
        const cleared = clearDeletedProjectsUnder(this.db, basePath);
        if (cleared > 0) {
            this.logger.info("cleared deleted_projects entries for rescan", {
                basePath,
                cleared,
            });
        }

        const repoPaths: string[] = [];
        const worktreePaths = new Set<string>(); // Track worktree dirs to skip

        // Check if basePath itself is a git repo (handles user selecting a single repo)
        try {
            const baseEntries = await readdir(basePath, {
                withFileTypes: true,
            });
            const baseGit = baseEntries.find((e) => e.name === ".git");
            if (baseGit?.isDirectory() || baseGit?.isFile()) {
                this.logger.info("basePath is itself a git repo", { basePath });
                repoPaths.push(basePath);
            }
        } catch {
            // If we can't read basePath, scanDir below will also fail gracefully
        }

        await this.scanDir(basePath, 0, repoPaths);

        this.logger.info("scanDir found repo candidates", {
            basePath,
            count: repoPaths.length,
            paths: repoPaths,
        });

        // First pass: discover all worktrees so we can exclude them
        for (const repoPath of repoPaths) {
            const wts = await this.discoverWorktrees(repoPath);
            for (const wt of wts) {
                if (!wt.isMain) {
                    worktreePaths.add(wt.path);
                }
            }
        }

        // Second pass: register projects (skip worktree directories)
        const projects: Project[] = [];
        for (const repoPath of repoPaths) {
            if (worktreePaths.has(repoPath)) continue; // This is a worktree, skip

            const name = basename(repoPath);

            // Get worktrees with activity info
            const worktrees = await this.discoverWorktrees(repoPath);

            // Derive project-level last activity as MAX across all worktrees
            let lastActivityAt: string | undefined;
            for (const wt of worktrees) {
                if (wt.lastActivityAt) {
                    if (!lastActivityAt || wt.lastActivityAt > lastActivityAt) {
                        lastActivityAt = wt.lastActivityAt;
                    }
                }
            }

            // Fallback: last commit on main repo
            if (!lastActivityAt) {
                const dateStr = await runGit(["log", "-1", "--format=%aI"], {
                    projectPath: repoPath,
                    label: "ProjectScanner",
                });
                if (dateStr) lastActivityAt = dateStr;
            }

            const project = upsertProject(
                this.db,
                repoPath,
                name,
                lastActivityAt,
                worktrees,
            );
            projects.push(project);
        }

        this.logger.info("scan complete", {
            basePath,
            repoCount: projects.length,
        });
        return projects;
    }

    /**
     * Discover all worktrees for a given git repo path.
     * Uses `git worktree list --porcelain` to parse worktree info.
     */
    private async discoverWorktrees(repoPath: string): Promise<Worktree[]> {
        try {
            const output = await runGit(["worktree", "list", "--porcelain"], {
                projectPath: repoPath,
                label: "ProjectScanner",
            });
            if (!output) return [];

            const worktrees: Worktree[] = [];
            const blocks = output.split("\n\n");

            for (const block of blocks) {
                const lines = block.trim().split("\n");
                let path = "";
                let branch = "";
                let isBare = false;

                for (const line of lines) {
                    if (line.startsWith("worktree ")) {
                        path = line.substring("worktree ".length);
                    } else if (line.startsWith("branch ")) {
                        // refs/heads/main → main
                        branch = line
                            .substring("branch ".length)
                            .replace("refs/heads/", "");
                    } else if (line === "bare") {
                        isBare = true;
                    } else if (line === "detached") {
                        branch = "(detached)";
                    }
                }

                if (!path || isBare) continue;

                const isMain = path === repoPath;

                // Get activity for this worktree using Source of Truth strategy:
                // 1. Check uncommitted files → find latest mtime
                // 2. Else use last commit timestamp
                const activity = await this.getWorktreeActivity(path);

                worktrees.push({
                    path,
                    branch: branch || "unknown",
                    isMain,
                    lastActivityAt: activity.lastActivityAt,
                    uncommittedCount: activity.uncommittedCount,
                    uncommittedFiles: activity.uncommittedFiles,
                });
            }

            return worktrees;
        } catch (err: unknown) {
            this.logger.warn("failed to list worktrees", {
                repoPath,
                error: toErrorData(err),
            });
            return [];
        }
    }

    /**
     * Get activity info for a single worktree path using the Source of Truth strategy:
     * 1. If uncommitted files exist → use latest file mtime
     * 2. Else → use last commit timestamp
     */
    private async getWorktreeActivity(worktreePath: string): Promise<{
        lastActivityAt: string | null;
        uncommittedCount: number;
        uncommittedFiles: string[];
    }> {
        const { uncommittedFiles, latestMtime } =
            await getUncommittedFileStatus(worktreePath, "Scanner");

        if (latestMtime) {
            return {
                lastActivityAt: latestMtime.toISOString(),
                uncommittedCount: uncommittedFiles.length,
                uncommittedFiles,
            };
        }

        // Fallback: last commit timestamp
        const dateStr = await runGit(["log", "-1", "--format=%aI"], {
            projectPath: worktreePath,
            label: "ProjectScanner",
        });
        if (dateStr) {
            return {
                lastActivityAt: dateStr,
                uncommittedCount: 0,
                uncommittedFiles: [],
            };
        }

        return {
            lastActivityAt: null,
            uncommittedCount: 0,
            uncommittedFiles: [],
        };
    }

    private async scanDir(
        dirPath: string,
        depth: number,
        results: string[],
    ): Promise<void> {
        if (depth > MAX_DEPTH) return;

        try {
            const entries = await readdir(dirPath, { withFileTypes: true });

            // Check if this directory is a git repo (has .git directory)
            // or a worktree (has .git file pointing to parent repo)
            const gitEntry = entries.find((e) => e.name === ".git");
            const hasGitDir = gitEntry?.isDirectory();
            const hasGitFile = gitEntry?.isFile(); // Worktree indicator

            if ((hasGitDir || hasGitFile) && depth > 0) {
                results.push(dirPath);
                return;
            }

            // Recurse into subdirectories
            for (const entry of entries) {
                if (!entry.isDirectory()) continue;
                if (entry.name.startsWith(".") && entry.name !== ".git")
                    continue;
                if (SKIP_DIRS.has(entry.name)) continue;

                await this.scanDir(
                    join(dirPath, entry.name),
                    depth + 1,
                    results,
                );
            }
        } catch (err: unknown) {
            const errorCode =
                err instanceof Error && "code" in err
                    ? (err as Error & { code?: string }).code
                    : undefined;
            if (errorCode !== "EACCES" && errorCode !== "EPERM") {
                this.logger.error("error scanning directory", {
                    dirPath,
                    error: toErrorData(err),
                });
            }
        }
    }
}
