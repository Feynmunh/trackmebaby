import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { nowIso } from "../../../shared/time.ts";
import { runMigrations } from "../schema.ts";
import {
    deleteWardenInsightsByProject,
    getWardenInsight,
    getWardenInsightCountsByProject,
    getWardenInsights,
    insertWardenInsight,
    updateWardenInsightStatus,
} from "./warden.ts";

let db: Database;
const testProjectId = Bun.randomUUIDv7();

beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);

    // Insert a test project so we have a valid projectId for foreign key constraints
    db.query(
        "INSERT INTO projects (id, path, name, created_at) VALUES (?, ?, ?, ?)",
    ).run(testProjectId, "/test/project", "Test Project", nowIso());
});

describe("Warden Queries", () => {
    describe("insertWardenInsight", () => {
        test("creates insight with UUIDv7 ID and status 'new'", () => {
            const insight = insertWardenInsight(
                db,
                testProjectId,
                "warning",
                "security",

                "API Key exposed",
                "Found API key in source code",
                ["src/index.ts"],
            );

            expect(insight.id).toBeTruthy();
            expect(insight.id.length).toBeGreaterThan(30); // UUID length
            expect(insight.projectId).toBe(testProjectId);
            expect(insight.status).toBe("new");
            expect(insight.severity).toBe("warning");

            expect(insight.category).toBe("security");
            expect(insight.title).toBe("API Key exposed");
            expect(insight.description).toBe("Found API key in source code");
            expect(insight.affectedFiles).toEqual(["src/index.ts"]);
            expect(insight.createdAt).toBeTruthy();
            expect(insight.resolvedAt).toBeNull();
        });

        test("handles null affectedFiles", () => {
            const insight = insertWardenInsight(
                db,
                testProjectId,
                "info",
                "tech_debt",

                "Title",
                "Desc",
                null,
            );
            expect(insight.affectedFiles).toBeNull();

            const retrieved = getWardenInsight(db, insight.id);
            expect(retrieved).toBeTruthy();
            // Note: mapWardenInsight returns [] for null affected_files in DB
            expect(retrieved?.affectedFiles).toBeNull();
        });
    });

    describe("getWardenInsights", () => {
        test("returns all insights for project ordered by created_at DESC", async () => {
            insertWardenInsight(
                db,
                testProjectId,
                "info",
                "tech_debt",
                "1",
                "d",
            );

            // Wait a bit to ensure different timestamps for ordering test
            await new Promise((r) => setTimeout(r, 10));
            insertWardenInsight(
                db,
                testProjectId,
                "info",
                "tech_debt",
                "2",
                "d",
            );

            const insights = getWardenInsights(db, testProjectId);
            expect(insights).toHaveLength(2);
            // Ordering is created_at DESC, so newest (2) should be first
            expect(insights[0].title).toBe("2");
            expect(insights[1].title).toBe("1");
        });

        test("filters by status", () => {
            const i1 = insertWardenInsight(
                db,
                testProjectId,
                "info",
                "tech_debt",
                "1",
                "d",
            );
            const i2 = insertWardenInsight(
                db,
                testProjectId,
                "info",
                "tech_debt",
                "2",
                "d",
            );

            updateWardenInsightStatus(db, i1.id, "approved");

            const newInsights = getWardenInsights(db, testProjectId, "new");
            expect(newInsights).toHaveLength(1);
            expect(newInsights[0].id).toBe(i2.id);

            const approvedInsights = getWardenInsights(
                db,
                testProjectId,
                "approved",
            );
            expect(approvedInsights).toHaveLength(1);
            expect(approvedInsights[0].id).toBe(i1.id);
        });

        test("returns empty array for project with no insights", () => {
            const insights = getWardenInsights(db, testProjectId);
            expect(insights).toEqual([]);
        });
    });

    describe("getWardenInsight", () => {
        test("retrieves single insight by ID", () => {
            const insight = insertWardenInsight(
                db,
                testProjectId,
                "info",
                "tech_debt",

                "T",
                "D",
                ["file.ts"],
            );
            const retrieved = getWardenInsight(db, insight.id);
            expect(retrieved).toEqual(insight);
        });
        test("returns null for nonexistent ID", () => {
            expect(getWardenInsight(db, "nonexistent")).toBeNull();
        });
    });

    describe("updateWardenInsightStatus", () => {
        test("updates status and sets resolved_at", () => {
            const insight = insertWardenInsight(
                db,
                testProjectId,
                "info",
                "tech_debt",

                "T",
                "D",
            );
            expect(insight.resolvedAt).toBeNull();

            const success = updateWardenInsightStatus(
                db,
                insight.id,
                "approved",
            );
            expect(success).toBe(true);

            const updated = getWardenInsight(db, insight.id);
            expect(updated?.status).toBe("approved");
            expect(updated?.resolvedAt).toBeTruthy();
        });

        test("returns false for nonexistent ID", () => {
            const success = updateWardenInsightStatus(
                db,
                "nonexistent",
                "approved",
            );
            expect(success).toBe(false);
        });
    });

    describe("deleteWardenInsightsByProject", () => {
        test("removes all insights for project", () => {
            insertWardenInsight(
                db,
                testProjectId,
                "info",
                "tech_debt",
                "1",
                "d",
            );
            insertWardenInsight(
                db,
                testProjectId,
                "info",
                "tech_debt",
                "2",
                "d",
            );

            deleteWardenInsightsByProject(db, testProjectId);

            const insights = getWardenInsights(db, testProjectId);
            expect(insights).toHaveLength(0);
        });
    });

    describe("getWardenInsightCountsByProject", () => {
        test("returns correct counts per status", () => {
            const i1 = insertWardenInsight(
                db,
                testProjectId,
                "info",
                "tech_debt",
                "1",
                "d",
            );
            const i2 = insertWardenInsight(
                db,
                testProjectId,
                "info",
                "tech_debt",
                "2",
                "d",
            );
            const i3 = insertWardenInsight(
                db,
                testProjectId,
                "info",
                "tech_debt",
                "3",
                "d",
            );
            insertWardenInsight(
                db,
                testProjectId,
                "info",
                "tech_debt",
                "4",
                "d",
            );

            updateWardenInsightStatus(db, i1.id, "approved");
            updateWardenInsightStatus(db, i2.id, "liked");
            updateWardenInsightStatus(db, i3.id, "liked");
            // i4 remains "new"

            const counts = getWardenInsightCountsByProject(db, testProjectId);
            expect(counts).toEqual({
                new: 1,
                approved: 1,
                liked: 2,
            });
        });

        test("returns zero counts for empty project", () => {
            const counts = getWardenInsightCountsByProject(db, testProjectId);
            expect(counts).toEqual({
                new: 0,
                approved: 0,
                liked: 0,
            });
        });
    });
});
