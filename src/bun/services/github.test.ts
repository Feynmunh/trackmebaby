import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import { secrets } from "bun";
import { setSetting } from "../db/queries.ts";
import { runMigrations } from "../db/schema.ts";
import { GitHubService } from "./github.ts";

let db: Database;
let service: GitHubService;

beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    service = new GitHubService(db);
});

describe("GitHubService token storage", () => {
    test("is unauthenticated when no token exists", async () => {
        await secrets
            .delete({
                service: "com.trackmebaby.github",
                name: "github:access-token",
            })
            .catch(() => undefined);
        expect(await service.isAuthenticated()).toBe(false);
    });

    test("uses fallback sqlite token if present", async () => {
        await secrets
            .delete({
                service: "com.trackmebaby.github",
                name: "github:access-token",
            })
            .catch(() => undefined);
        setSetting(db, "githubAccessToken", "fallback-token");
        expect(await service.getAccessToken()).toBe("fallback-token");
        expect(await service.isAuthenticated()).toBe(true);
    });

    test("uses keychain token if present", async () => {
        const spy = spyOn(secrets, "get").mockResolvedValue("secure-token");
        expect(await service.getAccessToken()).toBe("secure-token");
        expect(await service.isAuthenticated()).toBe(true);
        spy.mockRestore();
    });
});
