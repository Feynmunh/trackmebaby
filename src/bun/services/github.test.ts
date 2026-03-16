import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
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
    afterEach(() => {
        spyOn(secrets, "get").mockRestore();
        spyOn(secrets, "set").mockRestore();
        spyOn(secrets, "delete").mockRestore();
    });

    test("is unauthenticated when no token exists", async () => {
        const getSpy = spyOn(secrets, "get").mockResolvedValue(null);
        spyOn(secrets, "set").mockResolvedValue(undefined);
        spyOn(secrets, "delete").mockResolvedValue(false);

        expect(await service.isAuthenticated()).toBe(false);
        expect(getSpy).toHaveBeenCalled();
    });

    test("uses fallback sqlite token if present", async () => {
        const getSpy = spyOn(secrets, "get").mockImplementation(
            async ({ name }) => {
                if (name === "__trackmebaby_probe__") {
                    return null;
                }
                return null;
            },
        );
        spyOn(secrets, "set").mockResolvedValue(undefined);
        spyOn(secrets, "delete").mockResolvedValue(false);

        setSetting(db, "githubAccessToken", "fallback-token");
        expect(await service.getAccessToken()).toBe("fallback-token");
        expect(await service.isAuthenticated()).toBe(true);
        expect(getSpy).toHaveBeenCalled();
    });

    test("uses keychain token if present", async () => {
        const getSpy = spyOn(secrets, "get").mockImplementation(
            async ({ name }) => {
                if (name === "__trackmebaby_probe__") {
                    return null;
                }
                if (name === "github:access-token") {
                    return "secure-token";
                }
                return null;
            },
        );
        spyOn(secrets, "set").mockResolvedValue(undefined);
        spyOn(secrets, "delete").mockResolvedValue(false);

        expect(await service.getAccessToken()).toBe("secure-token");
        expect(await service.isAuthenticated()).toBe(true);
        expect(getSpy).toHaveBeenCalled();
    });
});
