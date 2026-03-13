import type { Database } from "bun:sqlite";
import type {
    ProjectTodo,
    ProjectTodoSource,
    ProjectTodoStatus,
} from "../../../shared/types.ts";

interface ProjectTodoRow {
    id: string;
    project_id: string;
    task: string;
    status: string;
    source: string;
    created_at: string;
    completed_at: string | null;
    deleted_at: string | null;
}

function mapProjectTodo(row: ProjectTodoRow): ProjectTodo {
    return {
        id: row.id,
        projectId: row.project_id,
        task: row.task,
        status: row.status as ProjectTodoStatus,
        source: row.source as ProjectTodoSource,
        created_at: row.created_at,
        completed_at: row.completed_at,
        deleted_at: row.deleted_at,
    };
}

export function getProjectTodos(
    db: Database,
    projectId: string,
): ProjectTodo[] {
    const rows = db
        .query(
            "SELECT * FROM project_todos WHERE project_id = ? AND deleted_at IS NULL ORDER BY status ASC, created_at DESC",
        )
        .all(projectId) as ProjectTodoRow[];
    return rows.map(mapProjectTodo);
}

export function insertProjectTodo(
    db: Database,
    projectId: string,
    task: string,
    source: "manual" | "auto" = "manual",
): ProjectTodo {
    // For auto-generated todos, check if a pending one already exists with the same task
    if (source === "auto") {
        const existing = db
            .query(
                "SELECT * FROM project_todos WHERE project_id = ? AND task = ? AND status = 'pending' AND deleted_at IS NULL",
            )
            .get(projectId, task) as ProjectTodoRow | null;
        if (existing) {
            return mapProjectTodo(existing);
        }
    }

    const id = Bun.randomUUIDv7();
    const now = new Date().toISOString();

    db.query(
        "INSERT INTO project_todos (id, project_id, task, source, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run(id, projectId, task, source, now);

    const row = db
        .query("SELECT * FROM project_todos WHERE id = ?")
        .get(id) as ProjectTodoRow;
    return mapProjectTodo(row);
}

export function updateProjectTodoStatus(
    db: Database,
    id: string,
    status: "pending" | "completed",
): void {
    const completedAt =
        status === "completed" ? new Date().toISOString() : null;
    db.query(
        "UPDATE project_todos SET status = ?, completed_at = ? WHERE id = ?",
    ).run(status, completedAt, id);
}

export function deleteProjectTodo(db: Database, id: string): void {
    const now = new Date().toISOString();
    db.query("UPDATE project_todos SET deleted_at = ? WHERE id = ?").run(
        now,
        id,
    );
}

export function deleteCompletedProjectTodos(
    db: Database,
    projectId: string,
): void {
    const now = new Date().toISOString();
    db.query(
        "UPDATE project_todos SET deleted_at = ? WHERE project_id = ? AND status = 'completed' AND deleted_at IS NULL",
    ).run(now, projectId);
}

export function getPendingAutoTodos(
    db: Database,
    projectId: string,
): ProjectTodo[] {
    const rows = db
        .query(
            "SELECT * FROM project_todos WHERE project_id = ? AND source = 'auto' AND status = 'pending' AND deleted_at IS NULL",
        )
        .all(projectId) as ProjectTodoRow[];
    return rows.map(mapProjectTodo);
}
