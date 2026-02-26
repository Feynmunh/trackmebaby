/**
 * Tests for settings service
 */

import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { runMigrations } from "../db/schema.ts";
import { SettingsService } from "./settings.ts";

let db: Database;
let settings: SettingsService;

beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    settings = new SettingsService(db);
});

describe("SettingsService", () => {
    test("returns default values for unset settings", () => {
        expect(settings.getBasePath()).toBeNull();
        expect(settings.getAIProvider()).toBe("groq");
        expect(settings.getAIModel()).toBe("llama-3.3-70b-versatile");
        expect(settings.getPollInterval()).toBe(60000);
        expect(settings.getWatchDebounce()).toBe(500);
    });

    test("setBasePath and getBasePath round-trip", () => {
        settings.setBasePath("/home/user/projects");
        expect(settings.getBasePath()).toBe("/home/user/projects");
    });

    test("setAIProvider overwrites default", () => {
        settings.setAIProvider("openai");
        expect(settings.getAIProvider()).toBe("openai");
    });

    test("setPollInterval enforces minimum 30s", () => {
        settings.setPollInterval(10000); // Too low
        expect(settings.getPollInterval()).toBe(30000);
    });

    test("setWatchDebounce enforces minimum 100ms", () => {
        settings.setWatchDebounce(50); // Too low
        expect(settings.getWatchDebounce()).toBe(100);
    });

    test("getAll returns complete settings object", () => {
        settings.setBasePath("/projects");
        settings.setAIProvider("openai");

        const all = settings.getAll();
        expect(all.basePath).toBe("/projects");
        expect(all.aiProvider).toBe("openai");
        expect(all.aiModel).toBe("llama-3.3-70b-versatile");
        expect(all.pollInterval).toBe(60000);
        expect(all.watchDebounce).toBe(500);
    });

    test("updateMany updates multiple settings at once", () => {
        settings.updateMany({
            basePath: "/home/user/code",
            aiProvider: "openai",
            pollInterval: 120000,
        });

        expect(settings.getBasePath()).toBe("/home/user/code");
        expect(settings.getAIProvider()).toBe("openai");
        expect(settings.getPollInterval()).toBe(120000);
        // Unchanged
        expect(settings.getAIModel()).toBe("llama-3.3-70b-versatile");
    });
});
