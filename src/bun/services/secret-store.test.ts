import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import { secrets } from "bun";
import { getSetting, setSetting } from "../db/queries.ts";
import { runMigrations } from "../db/schema.ts";
import { SecretStore } from "./secret-store.ts";

let db: Database;
let store: SecretStore;

beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    store = new SecretStore(db, {
        serviceName: "com.trackmebaby.test",
    });
});

describe("SecretStore", () => {
    test("stores secret in fallback when keychain unavailable", async () => {
        const getSpy = spyOn(secrets, "get").mockRejectedValue(
            new Error("unavailable"),
        );

        const result = await store.setSecret(
            "github:access-token",
            "githubAccessToken",
            "abc123",
        );

        expect(result.storageMode).toBe("local_unencrypted");
        expect(result.keychainAvailable).toBe(false);
        expect(getSetting(db, "githubAccessToken")).toBe("abc123");

        getSpy.mockRestore();
    });

    test("stores secret in keychain when available", async () => {
        const getSpy = spyOn(secrets, "get").mockResolvedValue(null);
        const setSpy = spyOn(secrets, "set").mockResolvedValue(undefined);

        const result = await store.setSecret(
            "github:access-token",
            "githubAccessToken",
            "secure-token",
        );

        expect(result.storageMode).toBe("secure");
        expect(result.keychainAvailable).toBe(true);
        expect(setSpy).toHaveBeenCalled();
        expect(getSetting(db, "githubAccessToken")).toBe("");

        getSpy.mockRestore();
        setSpy.mockRestore();
    });

    test("reads keychain before fallback", async () => {
        const getSpy = spyOn(secrets, "get")
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce("secure-token");
        const setSpy = spyOn(secrets, "set").mockResolvedValue(undefined);

        await store.setSecret(
            "github:access-token",
            "githubAccessToken",
            "fallback-token",
        );

        const token = await store.getSecret(
            "github:access-token",
            "githubAccessToken",
        );
        expect(token).toBe("secure-token");

        getSpy.mockRestore();
        setSpy.mockRestore();
    });

    test("migrates fallback token to keychain", async () => {
        const getSpy = spyOn(secrets, "get")
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce("fallback-token");
        const setSpy = spyOn(secrets, "set").mockResolvedValue(undefined);

        setSetting(db, "githubAccessToken", "fallback-token");

        const migrated = await store.migrateFallbackToKeychain(
            "github:access-token",
            "githubAccessToken",
        );

        expect(migrated).toBe(true);
        expect(setSpy).toHaveBeenCalled();

        getSpy.mockRestore();
        setSpy.mockRestore();
    });
});
