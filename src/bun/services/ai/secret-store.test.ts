import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import { secrets } from "bun";
import { getSetting } from "../../db/queries.ts";
import { runMigrations } from "../../db/schema.ts";
import { AISecretStore } from "./secret-store.ts";

let db: Database;
let store: AISecretStore;

beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    store = new AISecretStore(db);
});

describe("AISecretStore", () => {
    test("stores key in local fallback when keychain is unavailable", async () => {
        const getSpy = spyOn(secrets, "get").mockRejectedValue(
            new Error("secret service unavailable"),
        );
        const setSpy = spyOn(secrets, "set").mockResolvedValue(undefined);

        const result = await store.setApiKey("groq", "groq-secret");

        expect(result.storageMode).toBe("local_unencrypted");
        expect(result.keychainAvailable).toBe(false);
        expect(getSetting(db, "aiApiKey:groq")).toBe("groq-secret");
        getSpy.mockRestore();
        setSpy.mockRestore();
    });

    test("stores key in secure storage when keychain is available", async () => {
        const getSpy = spyOn(secrets, "get").mockResolvedValue(null);
        const setSpy = spyOn(secrets, "set").mockResolvedValue(undefined);

        const result = await store.setApiKey("gemini", "gemini-secret");

        expect(result.storageMode).toBe("secure");
        expect(result.keychainAvailable).toBe(true);
        expect(setSpy).toHaveBeenCalled();
        expect(getSetting(db, "aiApiKey:gemini")).toBe("");

        getSpy.mockRestore();
        setSpy.mockRestore();
    });

    test("reads secure key before local fallback", async () => {
        const getSpy = spyOn(secrets, "get")
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce("secure-key");
        const setSpy = spyOn(secrets, "set").mockResolvedValue(undefined);

        await store.setApiKey("groq", "local-groq");
        const resolved = await store.getApiKey("groq");

        expect(resolved).toBe("secure-key");
        getSpy.mockRestore();
        setSpy.mockRestore();
    });

    test("marks keychain unavailable when set fails and falls back to DB", async () => {
        const getSpy = spyOn(secrets, "get").mockResolvedValue(null);
        const setSpy = spyOn(secrets, "set").mockRejectedValue(
            new Error("set failed"),
        );

        const result = await store.setApiKey("groq", "groq-secret");

        expect(result.storageMode).toBe("local_unencrypted");
        expect(result.keychainAvailable).toBe(false);
        expect(getSetting(db, "aiApiKey:groq")).toBe("groq-secret");

        getSpy.mockRestore();
        setSpy.mockRestore();
    });

    test("marks keychain unavailable when delete fails", async () => {
        const getSpy = spyOn(secrets, "get").mockResolvedValue(null);
        const deleteSpy = spyOn(secrets, "delete").mockRejectedValue(
            new Error("delete failed"),
        );

        await store.setApiKey("gemini", "gemini-secret");
        await store.clearApiKey("gemini");

        const available = await store.isKeychainAvailable();
        expect(available).toBe(false);

        getSpy.mockRestore();
        deleteSpy.mockRestore();
    });

    test("short-circuits keychain reads within TTL when unavailable", async () => {
        const getSpy = spyOn(secrets, "get").mockRejectedValue(
            new Error("unavailable"),
        );

        const first = await store.getApiKey("groq");
        const second = await store.getApiKey("groq");

        expect(first).toBe("");
        expect(second).toBe("");
        expect(getSpy).toHaveBeenCalledTimes(1);

        getSpy.mockRestore();
    });
});
