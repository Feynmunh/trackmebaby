/**
 * File Watcher Service — monitors project directories for file changes
 * Uses @parcel/watcher-wasm with fallback to fs.watch for compatibility
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

                    this.watchers.set(projectPath, { unsubscribe, ignore: ig, useParcel: true });
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
        try {
            const watcher = watch(projectPath, { recursive: true }, (eventType, filename) => {
                if (!filename) return;
                this.handleRawEvent(projectPath, eventType, filename);
            });

            watcher.on("error", (err) => {
                console.error(`[Watcher] Error watching ${projectPath}:`, err.message);
            });

            this.watchers.set(projectPath, { 
                unsubscribe: () => watcher.close(), 
                ignore: ig,
                useParcel: false 
            });
            console.log(`[Watcher] Watching (fs.watch): ${projectPath}`);
        } catch (err: any) {
            console.error(`[Watcher] Failed to watch ${projectPath}:`, err.message);
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
