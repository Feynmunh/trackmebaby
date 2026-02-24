/**
 * File Watcher Service — monitors project directories for file changes
 * Uses @parcel/watcher-wasm with fallback to fs.watch for compatibility
 * Implements debouncing and .gitignore-aware filtering
 */
import { watch } from "node:fs";
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
    ".venv",
    "venv",
    "env",
    ".idea",
    ".vscode",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
];

interface WatcherInstance {
    unsubscribe: () => void;
    ignore: Ignore;
    useParcel: boolean;
}

let parcelLoadFailed = false;

async function tryLoadParcelWatcher() {
    if (parcelLoadFailed) return null;
    try {
        const parcel = await import("@parcel/watcher-wasm");
        return parcel;
    } catch {
        parcelLoadFailed = true;
        console.log("[Watcher] @parcel/watcher-wasm unavailable, using fs.watch fallback");
        return null;
    }
}

export class WatcherService {
    private watchers: Map<string, WatcherInstance> = new Map();
    private debounceTimers: Map<string, Timer> = new Map();
    private debounceMs: number;
    private db: Database;
    private callbacks: EventCallback[] = [];
    private useParcel: boolean = true;

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
    async addProject(projectPath: string): Promise<void> {
        if (this.watchers.has(projectPath)) return;

        const ig = this.buildIgnoreFilter(projectPath);

        if (this.useParcel) {
            const parcel = await tryLoadParcelWatcher();

            if (parcel) {
                try {
                    const unsubscribe = await parcel.subscribe(projectPath, (err, events) => {
                        if (err) {
                            console.error(`[Watcher] Error watching ${projectPath}:`, err.message);
                            return;
                        }
                        if (!events || events.length === 0) return;

                        for (const event of events) {
                            const relativePath = event.path;
                            if (ig.ignores(relativePath)) continue;
                            if (ig.ignores(relativePath.replace(/^\//, ""))) continue;

                            this.handleRawEvent(projectPath, event.type, event.path);
                        }
                    }, {
                        ignore: [
                            "**/node_modules/**",
                            "**/.git/**",
                            "**/dist/**",
                            "**/build/**",
                            "**/.next/**",
                            "**/.turbo/**",
                            "**/*.lock",
                            "**/.DS_Store",
                            "**/*.swp",
                            "**/*.swo",
                            "**/.env",
                            "**/coverage/**",
                            "**/.cache/**",
                            "**/__pycache__/**",
                        ],
                    });

                    this.watchers.set(projectPath, {
                        unsubscribe: () => {
                            (unsubscribe as any).unsubscribe();
                        },
                        ignore: ig,
                        useParcel: true
                    });
                    console.log(`[Watcher] Watching (parcel): ${projectPath}`);
                    return;
                } catch (err: any) {
                    console.log(`[Watcher] Parcel failed for ${projectPath}, falling back: ${err.message}`);
                }
            }
        }

        this.useParcel = false;
        this.addProjectFsWatch(projectPath, ig);
    }

    private addProjectFsWatch(projectPath: string, ig: Ignore): void {
        const watchers: (() => void)[] = [];

        const watchRecursive = (dir: string) => {
            try {
                const relativeDir = dir === projectPath ? "" : dir.slice(projectPath.length + 1);

                // If it's a directory we're about to watch, check if it's ignored
                if (relativeDir !== "" && ig.ignores(relativeDir)) {
                    return;
                }

                // Add non-recursive watcher to this directory
                const watcher = watch(dir, { recursive: false }, (eventType, filename) => {
                    if (!filename) return;
                    const relativePath = join(relativeDir, filename);
                    if (ig.ignores(relativePath)) return;

                    this.handleRawEvent(projectPath, eventType, relativePath);

                    // If a new directory is created, we need to watch it too
                    if (eventType === "rename") {
                        const fullPath = join(dir, filename);
                        if (existsSync(fullPath) && require("node:fs").statSync(fullPath).isDirectory()) {
                            watchRecursive(fullPath);
                        }
                    }
                });

                watcher.on("error", (err: any) => {
                    if (err.code === "ENOSPC") {
                        console.error(`[Watcher] ENOSPC error on ${dir}. inotify limit too low. Run: sudo sysctl fs.inotify.max_user_watches=524288`);
                    } else {
                        console.error(`[Watcher] Error on ${dir}:`, err.message);
                    }
                });

                watchers.push(() => watcher.close());

                // Recursively walk subdirectories
                const files = require("node:fs").readdirSync(dir, { withFileTypes: true });
                for (const file of files) {
                    if (file.isDirectory()) {
                        watchRecursive(join(dir, file.name));
                    }
                }
            } catch (err: any) {
                // Ignore access errors for restricted dirs
            }
        };

        try {
            watchRecursive(projectPath);
            this.watchers.set(projectPath, {
                unsubscribe: () => watchers.forEach(un => un()),
                ignore: ig,
                useParcel: false
            });
            console.log(`[Watcher] Watching (manual-recursive): ${projectPath}`);
        } catch (err: any) {
            console.error(`[Watcher] Failed manual watch for ${projectPath}:`, err.message);
        }
    }

    /**
     * Stop watching a project directory.
     */
    removeProject(projectPath: string): void {
        const instance = this.watchers.get(projectPath);
        if (instance) {
            instance.unsubscribe();
            this.watchers.delete(projectPath);
            console.log(`[Watcher] Stopped watching: ${projectPath}`);
        }
    }

    /**
     * Stop all watchers.
     */
    stopAll(): void {
        for (const [, instance] of this.watchers) {
            instance.unsubscribe();
        }
        this.watchers.clear();
        this.debounceTimers.clear();
    }

    /**
     * Get the number of active watchers.
     */
    get activeCount(): number {
        return this.watchers.size;
    }

    private handleRawEvent(projectPath: string, eventType: string | undefined, filename: string): void {
        const ig = this.watchers.get(projectPath)?.ignore;
        if (ig) {
            if (ig.ignores(filename)) return;
        }

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

    private emitEvent(projectPath: string, eventType: string | undefined, filename: string): void {
        let type: WatcherEvent["type"];
        const useParcel = this.watchers.get(projectPath)?.useParcel;

        if (useParcel) {
            if (eventType === "update") {
                type = "file_modify";
            } else if (eventType === "delete") {
                type = "file_delete";
            } else {
                const fullPath = join(projectPath, filename);
                type = existsSync(fullPath) ? "file_create" : "file_delete";
            }
        } else {
            if (eventType === "change") {
                type = "file_modify";
            } else {
                const fullPath = join(projectPath, filename);
                type = existsSync(fullPath) ? "file_create" : "file_delete";
            }
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

        ig.add(DEFAULT_IGNORES);

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
            }
        }

        return ig;
    }
}
