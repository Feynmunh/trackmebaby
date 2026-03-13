import type { Database } from "bun:sqlite";
import {
    deleteCompletedProjectTodos,
    deleteProject,
    deleteProjectTodo,
    getActivitySummary,
    getProjects,
    getProjectTodos,
    getRecentEvents,
    insertProjectTodo,
    updateProjectTodoStatus,
} from "../../../db/queries.ts";

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
        deleteProject: ({ projectId }: { projectId: string }) => {
            deleteProject(db, projectId);
            return { success: true };
        },
        getProjectTodos: ({ projectId }: { projectId: string }) => {
            return getProjectTodos(db, projectId);
        },
        addProjectTodo: ({
            projectId,
            task,
            source,
        }: {
            projectId: string;
            task: string;
            source?: "manual" | "auto";
        }) => {
            return insertProjectTodo(db, projectId, task, source);
        },
        updateProjectTodoStatus: ({
            id,
            status,
        }: {
            id: string;
            status: "pending" | "completed";
        }) => {
            updateProjectTodoStatus(db, id, status);
            return { success: true };
        },
        deleteProjectTodo: ({ id }: { id: string }) => {
            deleteProjectTodo(db, id);
            return { success: true };
        },
        deleteCompletedProjectTodos: ({ projectId }: { projectId: string }) => {
            deleteCompletedProjectTodos(db, projectId);
            return { success: true };
        },
    };
}
