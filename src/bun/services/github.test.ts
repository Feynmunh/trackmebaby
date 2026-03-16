import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { secrets } from "bun";
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
    let getSpy: ReturnType<typeof spyOn<typeof secrets, "get">> | null = null;
    let setSpy: ReturnType<typeof spyOn<typeof secrets, "set">> | null = null;
    let deleteSpy: ReturnType<typeof spyOn<typeof secrets, "delete">> | null =
        null;

    afterEach(() => {
        getSpy?.mockRestore();
        setSpy?.mockRestore();
        deleteSpy?.mockRestore();
        getSpy = null;
        setSpy = null;
        deleteSpy = null;
    });

    test("is unauthenticated when no token exists", async () => {
        getSpy = spyOn(secrets, "get").mockResolvedValue(null);
        setSpy = spyOn(secrets, "set").mockResolvedValue(undefined);
        deleteSpy = spyOn(secrets, "delete").mockResolvedValue(false);

        expect(await service.isAuthenticated()).toBe(false);
        expect(getSpy).toHaveBeenCalled();
    });

    test("uses keychain token if present", async () => {
        getSpy = spyOn(secrets, "get").mockImplementation(async ({ name }) => {
            if (name === "__trackmebaby_probe__") {
                return null;
            }
            if (name === "github:access-token") {
                return "secure-token";
            }
            return null;
        });
        setSpy = spyOn(secrets, "set").mockResolvedValue(undefined);
        deleteSpy = spyOn(secrets, "delete").mockResolvedValue(false);

        expect(await service.getAccessToken()).toBe("secure-token");
        expect(await service.isAuthenticated()).toBe(true);
        expect(getSpy).toHaveBeenCalled();
    });

    test("returns unauthenticated when keychain is unavailable", async () => {
        getSpy = spyOn(secrets, "get").mockRejectedValue(
            new Error("unavailable"),
        );
        setSpy = spyOn(secrets, "set").mockResolvedValue(undefined);
        deleteSpy = spyOn(secrets, "delete").mockResolvedValue(false);

        expect(await service.isAuthenticated()).toBe(false);
    });
});
