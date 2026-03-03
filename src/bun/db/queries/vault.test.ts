/**
 * Tests for Resource Vault database queries:
 * CRUD, ordering, filtering, pin toggling, JSON tag parsing, link preview
 */

import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { upsertProject } from "../queries.ts";
import { runMigrations } from "../schema.ts";
import {
    deleteVaultResource,
    getVaultResourceById,
    getVaultResources,
    insertVaultResource,
    toggleVaultResourcePin,
    updateVaultResource,
    updateVaultResourceLinkPreview,
} from "./vault.ts";

let db: Database;
let projectId: string;

beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    const project = upsertProject(db, "/tmp/vault-test", "vault-test");
    projectId = project.id;
});

describe("Vault CRUD", () => {
    test("inserts and retrieves a note resource", () => {
        const resource = insertVaultResource(
            db,
            projectId,
            "note",
            "My Note",
            "Some content",
        );

        expect(resource.id).toBeTruthy();
        expect(resource.type).toBe("note");
        expect(resource.title).toBe("My Note");
        expect(resource.content).toBe("Some content");
        expect(resource.isPinned).toBe(false);
        expect(resource.tags).toEqual([]);
        expect(resource.linkPreview).toBeNull();

        const fetched = getVaultResourceById(db, resource.id);
        expect(fetched).not.toBeNull();
        expect(fetched!.title).toBe("My Note");
    });

    test("inserts a link resource with URL and tags", () => {
        const resource = insertVaultResource(
            db,
            projectId,
            "link",
            "GitHub",
            "Code hosting",
            "https://github.com",
            ["dev", "git"],
        );

        expect(resource.type).toBe("link");
        expect(resource.url).toBe("https://github.com");
        expect(resource.tags).toEqual(["dev", "git"]);
    });

    test("updates resource title and content", () => {
        const resource = insertVaultResource(
            db,
            projectId,
            "idea",
            "Original",
            "Old",
        );

        const success = updateVaultResource(db, resource.id, {
            title: "Updated",
            content: "New content",
        });
        expect(success).toBe(true);

        const fetched = getVaultResourceById(db, resource.id);
        expect(fetched!.title).toBe("Updated");
        expect(fetched!.content).toBe("New content");
    });

    test("updates resource type", () => {
        const resource = insertVaultResource(db, projectId, "note", "Test", "");

        updateVaultResource(db, resource.id, { type: "milestone" });

        const fetched = getVaultResourceById(db, resource.id);
        expect(fetched!.type).toBe("milestone");
    });

    test("updates resource tags (JSON parsing)", () => {
        const resource = insertVaultResource(
            db,
            projectId,
            "note",
            "Test",
            "",
            undefined,
            ["old"],
        );

        updateVaultResource(db, resource.id, {
            tags: ["new", "updated"],
        });

        const fetched = getVaultResourceById(db, resource.id);
        expect(fetched!.tags).toEqual(["new", "updated"]);
    });

    test("returns false for empty updates", () => {
        const resource = insertVaultResource(db, projectId, "note", "Test", "");
        const success = updateVaultResource(db, resource.id, {});
        expect(success).toBe(false);
    });

    test("deletes a resource", () => {
        const resource = insertVaultResource(
            db,
            projectId,
            "note",
            "Delete me",
            "",
        );

        const success = deleteVaultResource(db, resource.id);
        expect(success).toBe(true);

        const fetched = getVaultResourceById(db, resource.id);
        expect(fetched).toBeNull();
    });

    test("returns false deleting non-existent resource", () => {
        const success = deleteVaultResource(db, "non-existent-id");
        expect(success).toBe(false);
    });

    test("returns null for non-existent getById", () => {
        const fetched = getVaultResourceById(db, "non-existent-id");
        expect(fetched).toBeNull();
    });
});

describe("Vault filtering & ordering", () => {
    test("returns resources for a specific project only", () => {
        const project2 = upsertProject(db, "/tmp/other", "other");

        insertVaultResource(db, projectId, "note", "Mine", "");
        insertVaultResource(db, project2.id, "note", "Theirs", "");

        const resources = getVaultResources(db, projectId);
        expect(resources).toHaveLength(1);
        expect(resources[0].title).toBe("Mine");
    });

    test("filters by type", () => {
        insertVaultResource(db, projectId, "note", "Note1", "");
        insertVaultResource(
            db,
            projectId,
            "link",
            "Link1",
            "",
            "https://x.com",
        );
        insertVaultResource(db, projectId, "idea", "Idea1", "");

        const notes = getVaultResources(db, projectId, "note");
        expect(notes).toHaveLength(1);
        expect(notes[0].type).toBe("note");

        const links = getVaultResources(db, projectId, "link");
        expect(links).toHaveLength(1);
        expect(links[0].type).toBe("link");
    });

    test("returns all types when no filter", () => {
        insertVaultResource(db, projectId, "note", "N", "");
        insertVaultResource(db, projectId, "link", "L", "", "https://x.com");
        insertVaultResource(db, projectId, "idea", "I", "");

        const all = getVaultResources(db, projectId);
        expect(all).toHaveLength(3);
    });

    test("orders pinned resources first", () => {
        insertVaultResource(db, projectId, "note", "Unpinned", "");
        const pinned = insertVaultResource(db, projectId, "note", "Pinned", "");
        toggleVaultResourcePin(db, pinned.id);

        const resources = getVaultResources(db, projectId);
        expect(resources[0].title).toBe("Pinned");
        expect(resources[0].isPinned).toBe(true);
        expect(resources[1].title).toBe("Unpinned");
        expect(resources[1].isPinned).toBe(false);
    });

    test("orders by created_at DESC within same pin status", () => {
        const first = insertVaultResource(db, projectId, "note", "First", "");
        // Backdate 'First' so 'Second' is clearly newer
        db.query("UPDATE vault_resources SET created_at = ? WHERE id = ?").run(
            "2024-01-01T00:00:00.000Z",
            first.id,
        );
        insertVaultResource(db, projectId, "note", "Second", "");

        const resources = getVaultResources(db, projectId);
        // Most recent (Second) should come first
        expect(resources[0].title).toBe("Second");
        expect(resources[1].title).toBe("First");
    });
});

describe("Vault pin toggling", () => {
    test("toggles pin on", () => {
        const resource = insertVaultResource(
            db,
            projectId,
            "note",
            "Pin me",
            "",
        );

        const result = toggleVaultResourcePin(db, resource.id);
        expect(result.success).toBe(true);
        expect(result.isPinned).toBe(true);

        const fetched = getVaultResourceById(db, resource.id);
        expect(fetched!.isPinned).toBe(true);
    });

    test("toggles pin off", () => {
        const resource = insertVaultResource(
            db,
            projectId,
            "note",
            "Unpin me",
            "",
        );

        toggleVaultResourcePin(db, resource.id); // pin
        const result = toggleVaultResourcePin(db, resource.id); // unpin
        expect(result.success).toBe(true);
        expect(result.isPinned).toBe(false);

        const fetched = getVaultResourceById(db, resource.id);
        expect(fetched!.isPinned).toBe(false);
    });

    test("returns failure for non-existent resource", () => {
        const result = toggleVaultResourcePin(db, "non-existent-id");
        expect(result.success).toBe(false);
        expect(result.isPinned).toBe(false);
    });
});

describe("Vault link preview", () => {
    test("stores and retrieves link preview as JSON", () => {
        const resource = insertVaultResource(
            db,
            projectId,
            "link",
            "Test Link",
            "",
            "https://example.com",
        );

        updateVaultResourceLinkPreview(db, resource.id, {
            title: "Example",
            description: "An example page",
            image: "https://example.com/og.png",
            favicon: "https://example.com/favicon.ico",
            siteName: "Example.com",
        });

        const fetched = getVaultResourceById(db, resource.id);
        expect(fetched!.linkPreview).not.toBeNull();
        expect(fetched!.linkPreview!.title).toBe("Example");
        expect(fetched!.linkPreview!.description).toBe("An example page");
        expect(fetched!.linkPreview!.image).toBe("https://example.com/og.png");
        expect(fetched!.linkPreview!.siteName).toBe("Example.com");
    });

    test("link preview defaults to null", () => {
        const resource = insertVaultResource(
            db,
            projectId,
            "link",
            "No Preview",
            "",
            "https://example.com",
        );

        const fetched = getVaultResourceById(db, resource.id);
        expect(fetched!.linkPreview).toBeNull();
    });
});
