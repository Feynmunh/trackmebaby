import type { Database } from "bun:sqlite";
import { toErrorData } from "../../../shared/error.ts";
import { createLogger } from "../../../shared/logger.ts";
import {
    getLatestGitSnapshot,
    getProjectById,
    insertGitSnapshot,
} from "../../db/queries.ts";
import type { GitTrackerService } from "../../services/git-tracker.ts";

export interface GitHandlersDeps {
    db: Database;
    gitTracker: GitTrackerService;
}

const logger = createLogger("rpc");

export function createGitHandlers({ db, gitTracker }: GitHandlersDeps) {
    return {
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
            return await gitTracker.getProjectStats(project.path);
        },
    };
}
