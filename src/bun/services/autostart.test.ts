/**
 * Tests for autostart service
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { AutostartService } from "./autostart.ts";

const TEST_CONFIG_DIR = "/tmp/trackmebaby-autostart-test/.config/autostart";

describe("AutostartService (Linux)", () => {
    let autostart: AutostartService;
    const originalHome = process.env.HOME;
    const originalXdg = process.env.XDG_CONFIG_HOME;

    beforeEach(() => {
        // Point XDG_CONFIG_HOME to temp dir
        const testConfigParent = "/tmp/trackmebaby-autostart-test/.config";
        process.env.XDG_CONFIG_HOME = testConfigParent;
        mkdirSync(testConfigParent, { recursive: true });
        autostart = new AutostartService();
    });

    afterEach(() => {
        process.env.HOME = originalHome;
        process.env.XDG_CONFIG_HOME = originalXdg;
        if (existsSync("/tmp/trackmebaby-autostart-test")) {
            rmSync("/tmp/trackmebaby-autostart-test", { recursive: true });
        }
    });

    test("enable creates .desktop file", async () => {
        const result = await autostart.enable("/usr/bin/trackmebaby");
        expect(result).toBe(true);

        const desktopPath = join(TEST_CONFIG_DIR, "trackmebaby.desktop");
        expect(existsSync(desktopPath)).toBe(true);
    });

    test("isEnabled returns true after enable", async () => {
        await autostart.enable("/usr/bin/trackmebaby");
        const enabled = await autostart.isEnabled();
        expect(enabled).toBe(true);
    });

    test("disable removes .desktop file", async () => {
        await autostart.enable("/usr/bin/trackmebaby");
        await autostart.disable();

        const desktopPath = join(TEST_CONFIG_DIR, "trackmebaby.desktop");
        expect(existsSync(desktopPath)).toBe(false);
    });

    test("isEnabled returns false after disable", async () => {
        await autostart.enable("/usr/bin/trackmebaby");
        await autostart.disable();
        const enabled = await autostart.isEnabled();
        expect(enabled).toBe(false);
    });

    test("disable is idempotent (no error if not enabled)", async () => {
        const result = await autostart.disable();
        expect(result).toBe(true);
    });
});
