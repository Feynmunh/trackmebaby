import { describe, expect, test } from "bun:test";
import { parseWardenResponse } from "./warden-prompt.ts";

describe("parseWardenResponse", () => {
    test("returns empty payload for invalid JSON", () => {
        expect(parseWardenResponse("not-json")).toEqual({
            insights: [],
            todos: [],
            completedTodoIds: [],
        });
    });

    test("filters invalid insights and maps completed_todo_ids", () => {
        const response = JSON.stringify({
            insights: [
                {
                    severity: "warning",
                    category: "testing_gap",
                    title: "Missing tests",
                    description: "Add tests for parser",
                    affectedFiles: ["src/a.ts", 1, null],
                },
                {
                    severity: "bad",
                    category: "testing_gap",
                    title: "Invalid severity",
                    description: "should be dropped",
                },
                {
                    severity: "info",
                    category: "unknown",
                    title: "Invalid category",
                    description: "should be dropped",
                },
            ],
            todos: [{ task: "Write tests for src/a.ts" }, { task: 123 }],
            completed_todo_ids: ["todo-1", 2, "todo-3"],
        });

        expect(parseWardenResponse(response)).toEqual({
            insights: [
                {
                    severity: "warning",
                    category: "testing_gap",
                    title: "Missing tests",
                    description: "Add tests for parser",
                    affectedFiles: ["src/a.ts"],
                },
            ],
            todos: [{ task: "Write tests for src/a.ts" }],
            completedTodoIds: ["todo-1", "todo-3"],
        });
    });

    test("normalizes missing arrays and empty affectedFiles", () => {
        const response = JSON.stringify({
            insights: [
                {
                    severity: "critical",
                    category: "security",
                    title: "Issue",
                    description: "Details",
                    affectedFiles: [],
                },
            ],
        });

        expect(parseWardenResponse(response)).toEqual({
            insights: [
                {
                    severity: "critical",
                    category: "security",
                    title: "Issue",
                    description: "Details",
                    affectedFiles: null,
                },
            ],
            todos: [],
            completedTodoIds: [],
        });
    });
});
