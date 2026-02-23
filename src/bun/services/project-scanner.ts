/**
 * Project Scanner — auto-detect git repos in a base folder
 * Recursively scans for directories containing .git (max depth 3)
 * Read-only: never modifies git repos
 */
import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, basename } from "node:path";
import type { Database } from "bun:sqlite";
import { upsertProject } from "../db/queries.ts";
import type { Project } from "../../shared/types.ts";

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
        await this.scanDir(basePath, 0, repoPaths);

        // Register each discovered repo as a project
        const projects: Project[] = [];
        for (const repoPath of repoPaths) {
            const name = basename(repoPath);
            const project = upsertProject(this.db, repoPath, name);
            projects.push(project);
        }

        console.log(`[Scanner] Found ${projects.length} git repos in ${basePath}`);
        return projects;
    }

    private async scanDir(
        dirPath: string,
        depth: number,
        results: string[]
    ): Promise<void> {
        if (depth > MAX_DEPTH) return;

        try {
            const entries = await readdir(dirPath, { withFileTypes: true });

            // Check if this directory itself is a git repo
            const hasGit = entries.some(
                (e) => e.name === ".git" && e.isDirectory()
            );

            if (hasGit && depth > 0) {
                // Found a git repo — don't scan deeper into it
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
