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
});
