# Database — trackmebaby

Trackmebaby uses `bun:sqlite` for all data persistence. The database is optimized for local performance with WAL mode enabled and uses a typed query layer for all operations.

## Connection Singleton

The database connection is managed as a singleton in `src/bun/db/database.ts` via the `getDatabase()` function.

- **Electrobun Mode**: Path is set to `Utils.paths.userData/trackmebaby.db`.
- **Standalone Mode**: Path defaults to `XDG_DATA_HOME/trackmebaby/trackmebaby.db`.
- **Testing**: In-memory storage is used via `Database(":memory:")`.

## Migrations

Migrations are versioned and located in `src/bun/db/schema.ts`. They are executed automatically during application startup via the `runMigrations(db)` function.

- The current schema version is **8**.
- Migrations are additive, using `CREATE TABLE IF NOT EXISTS` or `ALTER TABLE ADD COLUMN` statements.
- The `schema_version` table tracks the highest applied migration.

## Table Reference

| Table | Purpose | Key Columns |
| :--- | :--- | :--- |
| projects | Tracked project directories | id (UUIDv7), path, name, last_activity_at, createdAt |
| events | File system change events | id (UUIDv7), project_id, type, file_path, timestamp |
| git_snapshots | Git status and history snapshots | id (UUIDv7), project_id, branch, last_commit_hash, uncommitted_count |
| settings | Key-value application settings | key, value |
| conversations | AI chat conversation threads | id (UUIDv7), title, created_at, updated_at |
| chat_messages | History for chat conversations | id (UUIDv7), conversation_id, role, content, tagged_project_ids |
| warden_insights | AI-generated project analysis | id (UUIDv7), project_id, severity, category, status |
| vault_resources | Project bookmarks and notes | id (UUIDv7), project_id, type, title, content, tags |
| project_todos | Project-specific tasks | id (UUIDv7), project_id, task, status, source |
| schema_version | Tracks migration progress | version |

## Conventions and Design

### Primary Keys
All tables use **UUIDv7** for primary keys. These are time-sortable and globally unique. They are typically generated within the query functions using `Bun.randomUUIDv7()`.

### Query Layer

Operations are organized into typed functions within the `src/bun/db/queries/` directory.

| Module | Key Functions |
| :--- | :--- |
| projects.ts | `upsertProject`, `getProjects`, `getProjectById`, `getProjectByPath`, `deleteProject` |
| events.ts | `insertEvent`, `getRecentEvents` |
| activity.ts | `getActivitySummary` (groups events by date with counts) |
| git.ts | `insertGitSnapshot`, `getLatestGitSnapshot` |
| settings.ts | `getSetting`, `setSetting` |
| chat.ts | `createConversation`, `getConversations`, `getConversationMessages`, `insertChatMessage`, `deleteConversation`, `renameConversation` |
| vault.ts | `addVaultResource`, `getVaultResources`, `updateVaultResource`, `deleteVaultResource`, `toggleVaultResourcePin` |
| warden.ts | `insertWardenInsight`, `getWardenInsights`, `updateInsightStatus`, `getInsightCountsByProject` |
| todos.ts | `addProjectTodo`, `getProjectTodos`, `updateTodoStatus`, `deleteTodo`, `deleteCompletedTodos` |
The `src/bun/db/queries.ts` file acts as a barrel re-exporting all functions from the individual modules for easier access.

### Data Handling
- **Database Parameter**: Every query function takes `db: Database` as its first argument.
- **Typed Returns**: Functions return objects that match the interfaces defined in `src/shared/types.ts`.
- **JSON Serialization**: Complex data like `uncommittedFiles`, `tags`, or `screenContext` are stored as JSON strings and parsed automatically by the query layer.
- **Upsert Logic**: The app frequently uses `INSERT OR REPLACE` or custom manual check-then-update logic for upserts.
- **Timestamps**: All timestamps are stored as ISO 8601 strings to ensure consistent parsing across the backend and frontend.

### Adding a New Table

1. Add a new migration in `schema.ts` with the next version number.
2. Use `CREATE TABLE IF NOT EXISTS` with UUIDv7 primary key.
3. Create a typed query module in `db/queries/` with `db: Database` as first param.
4. Re-export from the barrel file `db/queries.ts`.
5. Define corresponding TypeScript interfaces in `shared/types.ts`.
6. Write tests using in-memory SQLite (`Database(":memory:")`).

### Testing Database Code

```typescript
import { Database } from "bun:sqlite";
import { describe, test, expect, beforeEach } from "bun:test";
import { runMigrations } from "../db/schema.ts";

let db: Database;
beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
});

describe("MyQuery", () => {
    test("round-trips data correctly", () => {
        const result = myQueryFunction(db, ...args);
        expect(result).toBeTruthy();
    });
});
```
