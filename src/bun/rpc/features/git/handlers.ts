import type { Database } from "bun:sqlite";
import { toErrorData } from "../../../../shared/error.ts";
import { createLogger } from "../../../../shared/logger.ts";
import { isIsoWithinMs, nowIso } from "../../../../shared/time.ts";
import {
    getLatestGitSnapshot,
    getProjectById,
    getProjectStatsCache,
    insertGitSnapshot,
    setProjectStatsCache,
} from "../../../db/queries.ts";
import { runGit } from "../../../services/git-command.ts";
import type { GitTrackerService } from "../../../services/git-tracker.ts";

export interface GitHandlersDeps {
    db: Database;
    gitTracker: GitTrackerService;
}

const logger = createLogger("rpc");
const STATS_CACHE_TTL_MS = 2 * 60 * 1000;
const MAX_DIFF_CHARS = 12000;
const statsInflight = new Map<string, Promise<void>>();

export function createGitHandlers({ db, gitTracker }: GitHandlersDeps) {
    return {
        getGitDiff: async ({ projectId }: { projectId: string }) => {
            const project = getProjectById(db, projectId);
            if (!project) return { diff: "", error: "Project not found." };
            try {
                const diff = await runGit(
                    [
                        "diff",
                        "--no-ext-diff",
                        "--no-textconv",
                        "--no-color",
                        "HEAD",
                    ],
                    {
                        projectPath: project.path,
                        label: "GitHandlers",
                        noTrim: true,
                        timeoutMs: 20000,
                    },
                );
                if (diff === null) {
                    return { diff: "", error: "Unable to load git diff." };
                }
                if (diff.length > MAX_DIFF_CHARS) {
                    const truncated = `${diff.substring(0, MAX_DIFF_CHARS)}\n\n(diff truncated)`;
                    return { diff: truncated };
                }
                return { diff };
            } catch (err: unknown) {
                logger.error("git diff error", {
                    error: toErrorData(err),
                });
                return { diff: "", error: "Unable to load git diff." };
            }
        },
        getGitStatus: async ({ projectId }: { projectId: string }) => {
            const cached = getLatestGitSnapshot(db, projectId);
            if (cached) return cached;

            const project = getProjectById(db, projectId);
            if (!project) return null;
            try {
                const snapshot = await gitTracker.getSnapshot(project.path);
                if (!snapshot) return null;
                return insertGitSnapshot(
                    db,
                    project.id,
                    snapshot.branch,
                    snapshot.lastCommitHash,
                    snapshot.lastCommitMessage,
                    snapshot.lastCommitTimestamp,
                    snapshot.uncommittedCount,
                    snapshot.uncommittedFiles,
                    snapshot.diffStats ?? undefined,
                );
            } catch (err: unknown) {
                logger.error("git snapshot error", {
                    error: toErrorData(err),
                });
                return null;
            }
        },
        getProjectStats: async ({ projectId }: { projectId: string }) => {
            const project = getProjectById(db, projectId);
            if (!project) return null;
            const cache = getProjectStatsCache(db, projectId);
            if (
                cache.stats &&
                isIsoWithinMs(cache.updatedAt, STATS_CACHE_TTL_MS)
            ) {
                return cache.stats;
            }

            if (cache.stats) {
                if (!statsInflight.has(projectId)) {
                    const pending = gitTracker
                        .getProjectStats(project.path)
                        .then((stats) => {
                            if (stats) {
                                setProjectStatsCache(
                                    db,
                                    projectId,
                                    stats,
                                    nowIso(),
                                );
                            }
                        })
                        .catch((err: unknown) => {
                            logger.warn("project stats refresh failed", {
                                projectId,
                                error: toErrorData(err),
                            });
                        })
                        .finally(() => {
                            statsInflight.delete(projectId);
                        });
                    statsInflight.set(projectId, pending);
                }
                return cache.stats;
            }

            try {
                const stats = await gitTracker.getProjectStats(project.path);
                if (stats) {
                    setProjectStatsCache(db, projectId, stats, nowIso());
                    return stats;
                }
            } catch (err: unknown) {
                logger.warn("project stats fetch failed", {
                    projectId,
                    error: toErrorData(err),
                });
            }

            return cache.stats;
        },
    };
}
