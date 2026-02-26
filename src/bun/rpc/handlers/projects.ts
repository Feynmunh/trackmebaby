import type { Database } from "bun:sqlite";
import {
    getActivitySummary,
    getProjects,
    getRecentEvents,
} from "../../db/queries.ts";

export interface ProjectHandlersDeps {
    db: Database;
}

export function createProjectHandlers({ db }: ProjectHandlersDeps) {
    return {
        getProjects: () => {
            return getProjects(db);
        },
        getProjectActivity: ({
            projectId,
            since,
        }: {
            projectId: string;
            since: string;
        }) => {
            return getRecentEvents(db, projectId, new Date(since), 20000);
        },
        getProjectActivitySummary: ({
            projectId,
            since,
            until,
        }: {
            projectId: string;
            since: string;
            until: string;
        }) => {
            return getActivitySummary(
                db,
                projectId,
                new Date(since),
                new Date(until),
            );
        },
    };
}
