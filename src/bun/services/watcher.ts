/**
 * File Watcher Service — monitors project directories for file changes
 * Uses Node's fs.watch (backed by inotify on Linux) with recursive mode
 * Implements debouncing and .gitignore-aware filtering
 */
import { watch, type FSWatcher } from "node:fs";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import ignore, { type Ignore } from "ignore";
import type { Database } from "bun:sqlite";
import { insertEvent, getProjectByPath } from "../db/queries.ts";

export interface WatcherEvent {
    type: "file_create" | "file_modify" | "file_delete";
    path: string;
    projectPath: string;
}

type EventCallback = (event: WatcherEvent) => void;

// Default ignore patterns (always filtered out)
const DEFAULT_IGNORES = [
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    ".turbo",
    "*.lock",
    ".DS_Store",
    "*.swp",
    "*.swo",
    ".env",
    "coverage",
    ".cache",
    "__pycache__",
];

export class WatcherService {
    private watchers: Map<string, FSWatcher> = new Map();
    private ignoreFilters: Map<string, Ignore> = new Map();
    private debounceTimers: Map<string, Timer> = new Map();
    private debounceMs: number;
    private db: Database;
    private callbacks: EventCallback[] = [];

    constructor(db: Database, debounceMs: number = 500) {
        this.db = db;
        this.debounceMs = debounceMs;
    }

    /**
     * Register a callback for watcher events.
     */
    onEvent(callback: EventCallback): void {
        this.callbacks.push(callback);
    }

    /**
     * Start watching a project directory.
     */
    addProject(projectPath: string): void {
        if (this.watchers.has(projectPath)) return;

        // Build ignore filter for this project
        const ig = this.buildIgnoreFilter(projectPath);
        this.ignoreFilters.set(projectPath, ig);

        try {
            const watcher = watch(projectPath, { recursive: true }, (eventType, filename) => {
                if (!filename) return;
                this.handleRawEvent(projectPath, eventType, filename);
            });

            watcher.on("error", (err) => {
                console.error(`[Watcher] Error watching ${projectPath}:`, err.message);
            });

            this.watchers.set(projectPath, watcher);
            console.log(`[Watcher] Watching: ${projectPath}`);
        } catch (err: any) {
            console.error(`[Watcher] Failed to watch ${projectPath}:`, err.message);
        }
    }

    /**
     * Stop watching a project directory.
     */
    removeProject(projectPath: string): void {
        const watcher = this.watchers.get(projectPath);
        if (watcher) {
            watcher.close();
            this.watchers.delete(projectPath);
            this.ignoreFilters.delete(projectPath);
            console.log(`[Watcher] Stopped watching: ${projectPath}`);
        }
    }

    /**
     * Stop all watchers.
     */
    stopAll(): void {
        for (const [, watcher] of this.watchers) {
            watcher.close();
        }
        this.watchers.clear();
        this.ignoreFilters.clear();
        this.debounceTimers.clear();
    }

    /**
     * Get the number of active watchers.
     */
    get activeCount(): number {
        return this.watchers.size;
    }

    private handleRawEvent(projectPath: string, eventType: string, filename: string): void {
        // Filter ignored files
        const ig = this.ignoreFilters.get(projectPath);
        if (ig && ig.ignores(filename)) return;

        // Debounce: use project+filename as key
        const debounceKey = `${projectPath}:${filename}`;
        const existingTimer = this.debounceTimers.get(debounceKey);
        if (existingTimer) clearTimeout(existingTimer);

        this.debounceTimers.set(
            debounceKey,
            setTimeout(() => {
                this.debounceTimers.delete(debounceKey);
                this.emitEvent(projectPath, eventType, filename);
            }, this.debounceMs)
        );
    }

    private emitEvent(projectPath: string, eventType: string, filename: string): void {
        // Map fs.watch events to our event types
        // fs.watch provides "rename" (create/delete) and "change" (modify)
        // We can't distinguish create from delete with fs.watch alone,
        // so we check if the file exists
        let type: WatcherEvent["type"];

        if (eventType === "change") {
            type = "file_modify";
        } else {
            // "rename" could be create or delete — check existence
            const fullPath = join(projectPath, filename);
            type = existsSync(fullPath) ? "file_create" : "file_delete";
        }

        const event: WatcherEvent = { type, path: filename, projectPath };

        // Persist to database
        try {
            const project = getProjectByPath(this.db, projectPath);
            if (project) {
                insertEvent(this.db, project.id, type, filename);
            }
        } catch (err: any) {
            console.error(`[Watcher] DB insert error:`, err.message);
        }

        // Notify callbacks
        for (const cb of this.callbacks) {
            try {
                cb(event);
            } catch (err: any) {
                console.error(`[Watcher] Callback error:`, err.message);
            }
        }
    }

    private buildIgnoreFilter(projectPath: string): Ignore {
        const ig = ignore();

        // Add default ignores
        ig.add(DEFAULT_IGNORES);

        // Parse .gitignore if exists
        const gitignorePath = join(projectPath, ".gitignore");
        if (existsSync(gitignorePath)) {
            try {
                const content = readFileSync(gitignorePath, "utf-8");
                const patterns = content
                    .split("\n")
                    .map((line) => line.trim())
                    .filter((line) => line && !line.startsWith("#"));
                ig.add(patterns);
            } catch {
                // Ignore parsing errors
            }
        }

        return ig;
    }
}
