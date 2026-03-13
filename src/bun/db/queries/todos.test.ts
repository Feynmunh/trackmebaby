import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { nowIso } from "../../../shared/time.ts";
import { runMigrations } from "../schema.ts";
import {
    deleteCompletedProjectTodos,
    deleteProjectTodo,
    getPendingAutoTodos,
    getProjectTodos,
    insertProjectTodo,
    updateProjectTodoStatus,
} from "./todos.ts";

let db: Database;
let projectId: string;

beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    projectId = Bun.randomUUIDv7();
    db.query(
        "INSERT INTO projects (id, path, name, created_at) VALUES (?, ?, ?, ?)",
    ).run(projectId, `/tmp/${projectId}`, "Test", nowIso());
});

describe("todos queries", () => {
    test("insertProjectTodo creates manual pending todos", () => {
        const todo = insertProjectTodo(db, projectId, "Write tests");
        expect(todo.projectId).toBe(projectId);
        expect(todo.task).toBe("Write tests");
        expect(todo.status).toBe("pending");
        expect(todo.source).toBe("manual");

        const list = getProjectTodos(db, projectId);
        expect(list).toHaveLength(1);
        expect(list[0].id).toBe(todo.id);
    });

    test("insertProjectTodo deduplicates pending auto todos", () => {
        const first = insertProjectTodo(db, projectId, "Auto task", "auto");
        const second = insertProjectTodo(db, projectId, "Auto task", "auto");
        expect(second.id).toBe(first.id);
        expect(getProjectTodos(db, projectId)).toHaveLength(1);
    });

    test("insertProjectTodo creates a new auto todo after completion", () => {
        const first = insertProjectTodo(db, projectId, "Auto task", "auto");
        updateProjectTodoStatus(db, first.id, "completed");

        const second = insertProjectTodo(db, projectId, "Auto task", "auto");
        expect(second.id).not.toBe(first.id);
        expect(getProjectTodos(db, projectId)).toHaveLength(2);
    });

    test("updateProjectTodoStatus toggles completed_at", () => {
        const todo = insertProjectTodo(db, projectId, "Task");
        updateProjectTodoStatus(db, todo.id, "completed");

        const completed = db
            .query(
                "SELECT status, completed_at FROM project_todos WHERE id = ?",
            )
            .get(todo.id) as { status: string; completed_at: string | null };
        expect(completed.status).toBe("completed");
        expect(completed.completed_at).toBeTruthy();

        updateProjectTodoStatus(db, todo.id, "pending");
        const pending = db
            .query(
                "SELECT status, completed_at FROM project_todos WHERE id = ?",
            )
            .get(todo.id) as { status: string; completed_at: string | null };
        expect(pending.status).toBe("pending");
        expect(pending.completed_at).toBeNull();
    });

    test("deleteProjectTodo soft-deletes and hides from listing", () => {
        const todo = insertProjectTodo(db, projectId, "Task");
        deleteProjectTodo(db, todo.id);

        expect(getProjectTodos(db, projectId)).toEqual([]);

        const row = db
            .query("SELECT deleted_at FROM project_todos WHERE id = ?")
            .get(todo.id) as { deleted_at: string | null };
        expect(row.deleted_at).toBeTruthy();
    });

    test("deleteCompletedProjectTodos only soft-deletes completed todos", () => {
        const pending = insertProjectTodo(db, projectId, "Pending", "manual");
        const completed = insertProjectTodo(db, projectId, "Completed", "auto");
        updateProjectTodoStatus(db, completed.id, "completed");

        deleteCompletedProjectTodos(db, projectId);

        const visible = getProjectTodos(db, projectId);
        expect(visible).toHaveLength(1);
        expect(visible[0].id).toBe(pending.id);
    });

    test("getPendingAutoTodos filters source, status, and deletion", () => {
        const autoPending = insertProjectTodo(db, projectId, "A", "auto");
        const autoCompleted = insertProjectTodo(db, projectId, "B", "auto");
        const manual = insertProjectTodo(db, projectId, "C", "manual");

        updateProjectTodoStatus(db, autoCompleted.id, "completed");
        deleteProjectTodo(db, manual.id);

        const pendingAuto = getPendingAutoTodos(db, projectId);
        expect(pendingAuto).toHaveLength(1);
        expect(pendingAuto[0].id).toBe(autoPending.id);
    });

    test("getProjectTodos orders by status ASC, then created_at DESC", () => {
        db.query(
            "INSERT INTO project_todos (id, project_id, task, status, source, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        ).run(
            "todo-completed",
            projectId,
            "completed",
            "completed",
            "manual",
            "2026-01-03T00:00:00.000Z",
        );
        db.query(
            "INSERT INTO project_todos (id, project_id, task, status, source, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        ).run(
            "todo-pending-old",
            projectId,
            "pending-old",
            "pending",
            "manual",
            "2026-01-01T00:00:00.000Z",
        );
        db.query(
            "INSERT INTO project_todos (id, project_id, task, status, source, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        ).run(
            "todo-pending-new",
            projectId,
            "pending-new",
            "pending",
            "manual",
            "2026-01-02T00:00:00.000Z",
        );

        const todos = getProjectTodos(db, projectId);
        expect(todos.map((todo) => todo.id)).toEqual([
            "todo-completed",
            "todo-pending-new",
            "todo-pending-old",
        ]);
    });
});
