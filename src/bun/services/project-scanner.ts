/**
 * Project Scanner — auto-detect git repos in a base folder
 * Recursively scans for directories containing .git (max depth 3)
 * Detects git worktrees and groups them under the main repo
 * Read-only: never modifies git repos
 */
import { readdir } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import type { Database } from "bun:sqlite";
import { upsertProject } from "../db/queries.ts";
import type { Project, Worktree } from "../../shared/types.ts";

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
    "target",      // Rust
    "vendor",      // Go
    ".gradle",
    ".idea",
    ".vscode",
]);

export class ProjectScanner {
    private db: Database;

    constructor(db: Database) {
        this.db = db;
    }

    /**
     * Scan a base folder for git repositories and register them as projects.
     * Returns the list of discovered projects.
     */
    async scan(basePath: string): Promise<Project[]> {
        if (!existsSync(basePath)) {
            console.error(`[Scanner] Base path does not exist: ${basePath}`);
            return [];
        }

        const repoPaths: string[] = [];
        const worktreePaths = new Set<string>(); // Track worktree dirs to skip
        await this.scanDir(basePath, 0, repoPaths);

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
                try {
                    const result = await Bun.$`git -C ${repoPath} log -1 --format="%aI"`.quiet();
                    const dateStr = result.text().trim();
                    if (dateStr) lastActivityAt = dateStr;
                } catch { }
            }

            const project = upsertProject(this.db, repoPath, name, lastActivityAt, worktrees);
            projects.push(project);
        }

        console.log(`[Scanner] Found ${projects.length} git repos in ${basePath}`);
        return projects;
    }

    /**
     * Discover all worktrees for a given git repo path.
     * Uses `git worktree list --porcelain` to parse worktree info.
     */
    private async discoverWorktrees(repoPath: string): Promise<Worktree[]> {
        try {
            const result = await Bun.$`git -C ${repoPath} worktree list --porcelain`.quiet();
            const output = result.text().trim();
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
                        branch = line.substring("branch ".length).replace("refs/heads/", "");
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
        } catch {
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
        let uncommittedFiles: string[] = [];
        let latestMtime: Date | null = null;

        try {
            const result = await Bun.$`git -C ${worktreePath} status --porcelain`.quiet();
            const output = result.text().trim();
            if (output) {
                uncommittedFiles = output
                    .split("\n")
                    .map(l => l.trim())
                    .filter(Boolean)
                    .map(l => l.substring(3));

                // Find latest mtime among uncommitted files
                for (const file of uncommittedFiles) {
                    try {
                        const fullPath = join(worktreePath, file);
                        const stats = statSync(fullPath);
                        if (!latestMtime || stats.mtime > latestMtime) {
                            latestMtime = stats.mtime;
                        }
                    } catch { /* file might be deleted */ }
                }
            }
        } catch { }

        if (latestMtime) {
            return {
                lastActivityAt: latestMtime.toISOString(),
                uncommittedCount: uncommittedFiles.length,
                uncommittedFiles,
            };
        }

        // Fallback: last commit timestamp
        try {
            const result = await Bun.$`git -C ${worktreePath} log -1 --format="%aI"`.quiet();
            const dateStr = result.text().trim();
            if (dateStr) {
                return {
                    lastActivityAt: dateStr,
                    uncommittedCount: 0,
                    uncommittedFiles: [],
                };
            }
        } catch { }

        return { lastActivityAt: null, uncommittedCount: 0, uncommittedFiles: [] };
    }

    private async scanDir(
        dirPath: string,
        depth: number,
        results: string[]
    ): Promise<void> {
        if (depth > MAX_DEPTH) return;

        try {
            const entries = await readdir(dirPath, { withFileTypes: true });

            // Check if this directory is a git repo (has .git directory)
            // or a worktree (has .git file pointing to parent repo)
            const gitEntry = entries.find(e => e.name === ".git");
            const hasGitDir = gitEntry?.isDirectory();
            const hasGitFile = gitEntry?.isFile(); // Worktree indicator

            if ((hasGitDir || hasGitFile) && depth > 0) {
                results.push(dirPath);
                return;
            }

            // Recurse into subdirectories
            for (const entry of entries) {
                if (!entry.isDirectory()) continue;
                if (entry.name.startsWith(".") && entry.name !== ".git") continue;
                if (SKIP_DIRS.has(entry.name)) continue;

                await this.scanDir(join(dirPath, entry.name), depth + 1, results);
            }
        } catch (err: any) {
            // Permission errors or other IO failures — skip silently
            if (err.code !== "EACCES" && err.code !== "EPERM") {
                console.error(`[Scanner] Error scanning ${dirPath}:`, err.message);
            }
        }
    }
}
