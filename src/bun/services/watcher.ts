/**
 * File Watcher Service — monitors project directories for file changes
 * Uses @parcel/watcher-wasm with fallback to fs.watch for compatibility
 * Implements debouncing and .gitignore-aware filtering
 */

import type { Database } from "bun:sqlite";
import {
    existsSync,
    readdirSync,
    readFileSync,
    statSync,
    watch,
} from "node:fs";
import { join } from "node:path";
import ignore, { type Ignore } from "ignore";
import { toErrorData } from "../../shared/error.ts";
import { createLogger } from "../../shared/logger.ts";
import { getProjectByPath, insertEvent } from "../db/queries.ts";

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
    unsubscribe: () => Promise<void> | void;
    ignore: Ignore;
    useParcel: boolean;
}

let parcelLoadFailed = false;

type ParcelSubscription = { unsubscribe: () => Promise<void> };

async function tryLoadParcelWatcher(): Promise<{
    subscribe: (
        path: string,
        cb: (
            err: Error | null,
            events?: Array<{ type: string; path: string }>,
        ) => void,
        options?: { ignore?: string[] },
    ) => Promise<ParcelSubscription>;
} | null> {
    if (parcelLoadFailed) return null;
    try {
        const parcel = await import("@parcel/watcher-wasm");
        return parcel;
    } catch (err: unknown) {
        parcelLoadFailed = true;
        logger.warn("parcel watcher unavailable, using fs.watch fallback", {
            error: toErrorData(err),
        });
        return null;
    }
}

const logger = createLogger("watcher");

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
                    const subscription = await parcel.subscribe(
                        projectPath,
                        (err, events) => {
                            if (err) {
                                logger.error("watcher error", {
                                    projectPath,
                                    error: { message: err.message },
                                });
                                return;
                            }
                            if (!events || events.length === 0) return;

                            for (const event of events) {
                                const relativePath = event.path;
                                if (ig.ignores(relativePath)) continue;
                                if (ig.ignores(relativePath.replace(/^\//, "")))
                                    continue;

                                this.handleRawEvent(
                                    projectPath,
                                    event.type,
                                    event.path,
                                );
                            }
                        },
                        {
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
                        },
                    );

                    this.watchers.set(projectPath, {
                        unsubscribe: () => subscription.unsubscribe(),
                        ignore: ig,
                        useParcel: true,
                    });
                    logger.info("watching (parcel)", { projectPath });
                    return;
                } catch (err: unknown) {
                    logger.warn("parcel watcher failed, falling back", {
                        projectPath,
                        error: toErrorData(err),
                    });
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
                const relativeDir =
                    dir === projectPath
                        ? ""
                        : dir.slice(projectPath.length + 1);

                // If it's a directory we're about to watch, check if it's ignored
                if (relativeDir !== "" && ig.ignores(relativeDir)) {
                    return;
                }

                // Add non-recursive watcher to this directory
                const watcher = watch(
                    dir,
                    { recursive: false },
                    (eventType, filename) => {
                        if (!filename) return;
                        const relativePath = join(relativeDir, filename);
                        if (ig.ignores(relativePath)) return;

                        this.handleRawEvent(
                            projectPath,
                            eventType,
                            relativePath,
                        );

                        // If a new directory is created, we need to watch it too
                        if (eventType === "rename") {
                            const fullPath = join(dir, filename);
                            if (
                                existsSync(fullPath) &&
                                statSync(fullPath).isDirectory()
                            ) {
                                watchRecursive(fullPath);
                            }
                        }
                    },
                );

                watcher.on("error", (err: unknown) => {
                    const errorCode =
                        err instanceof Error && "code" in err
                            ? (err as Error & { code?: string }).code
                            : undefined;
                    if (errorCode === "ENOSPC") {
                        logger.error("inotify limit too low", {
                            dir,
                            errorCode,
                        });
                    } else {
                        logger.error("watcher error", {
                            dir,
                            error: toErrorData(err),
                        });
                    }
                });

                watchers.push(() => watcher.close());

                // Recursively walk subdirectories
                const files = readdirSync(dir, { withFileTypes: true });
                for (const file of files) {
                    if (file.isDirectory()) {
                        watchRecursive(join(dir, file.name));
                    }
                }
            } catch (_err: unknown) {
                // Ignore access errors for restricted dirs
            }
        };

        try {
            watchRecursive(projectPath);
            this.watchers.set(projectPath, {
                unsubscribe: () => {
                    for (const un of watchers) {
                        un();
                    }
                },
                ignore: ig,
                useParcel: false,
            });
            logger.info("watching (manual-recursive)", { projectPath });
        } catch (err: unknown) {
            logger.error("failed manual watch", {
                projectPath,
                error: toErrorData(err),
            });
        }
    }

    /**
     * Stop watching a project directory.
     */
    removeProject(projectPath: string): void {
        const instance = this.watchers.get(projectPath);
        if (instance) {
            void instance.unsubscribe();
            this.watchers.delete(projectPath);
            logger.info("stopped watching", { projectPath });
        }
    }

    /**
     * Stop all watchers.
     */
    stopAll(): void {
        for (const [, instance] of this.watchers) {
            void instance.unsubscribe();
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

    private handleRawEvent(
        projectPath: string,
        eventType: string | undefined,
        filename: string,
    ): void {
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
            }, this.debounceMs),
        );
    }

    private emitEvent(
        projectPath: string,
        eventType: string | undefined,
        filename: string,
    ): void {
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
        } catch (err: unknown) {
            logger.error("db insert error", { error: toErrorData(err) });
        }

        // Notify callbacks
        for (const cb of this.callbacks) {
            try {
                cb(event);
            } catch (err: unknown) {
                logger.error("callback error", { error: toErrorData(err) });
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
            } catch (err: unknown) {
                logger.warn("failed to read .gitignore", {
                    gitignorePath,
                    error: toErrorData(err),
                });
            }
        }

        return ig;
    }
}
