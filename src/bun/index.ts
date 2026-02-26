/**
 * trackmebaby — Main entry point
 *
 * Starts as a background daemon with system tray.
 * Tray click opens the dashboard window.
 * Closing the window returns to tray-only mode.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import Electrobun, {
    BrowserWindow,
    Tray,
    Updater,
    Utils,
} from "electrobun/bun";
import { toErrorData } from "../shared/error.ts";
import { createLogger, setLogSink } from "../shared/logger.ts";
import { closeDatabase, getDatabase } from "./db/database.ts";
import { createRPC } from "./rpc/bridge.ts";
import { GitTrackerService } from "./services/git-tracker.ts";
import { ProjectScanner } from "./services/project-scanner.ts";
import { SettingsService } from "./services/settings.ts";
import { WatcherService } from "./services/watcher.ts";

const logger = createLogger("app");

// Use Electrobun's userData path for the database
let dbPath: string | undefined;
let logPath: string | undefined;
try {
    const userData = Utils.paths.userData;
    if (userData) {
        mkdirSync(userData, { recursive: true });
        dbPath = join(userData, "trackmebaby.db");
        const logDir = join(userData, "logs");
        mkdirSync(logDir, { recursive: true });
        logPath = join(logDir, "trackmebaby.log");
    }
} catch (err: unknown) {
    logger.warn("failed to resolve userData path", { error: toErrorData(err) });
}

if (logPath) {
    setLogSink((entry) => {
        try {
            appendFileSync(logPath, `${JSON.stringify(entry)}\n`);
        } catch (err: unknown) {
            console.error(
                `[logger] failed to write log:`,
                err instanceof Error ? err.message : err,
            );
        }
    });

const db = getDatabase(dbPath);
const settingsService = new SettingsService(db);
const scanner = new ProjectScanner(db);
const watcher = new WatcherService(db, settingsService.getWatchDebounce());
const gitTracker = new GitTrackerService(db, settingsService.getPollInterval());

// --- Window Management ---
const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

let mainWindow: InstanceType<typeof BrowserWindow> | null = null;

// --- RPC (needs getMainWindow for window control handlers) ---
const rpc = createRPC(
    db,
    settingsService,
    scanner,
    gitTracker,
    () => mainWindow,
);

async function getMainViewUrl(): Promise<string> {
    const channel = await Updater.localInfo.channel();
    if (channel === "dev") {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            await fetch(DEV_SERVER_URL, {
                method: "HEAD",
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            logger.info("hmr enabled", { url: DEV_SERVER_URL });
            return DEV_SERVER_URL;
        } catch (err: unknown) {
            logger.warn("dev server not available", {
                error: toErrorData(err),
            });
        }
    }
    return "views://mainview/index.html";
}

const isLinux = process.platform === "linux";
let isCreatingWindow = false;

async function createWindow(): Promise<void> {
    if (mainWindow) {
        mainWindow.focus();
        return;
    }

    // Prevent concurrent window creation
    if (isCreatingWindow) {
        return;
    }
    isCreatingWindow = true;

    try {
        const url = await getMainViewUrl();

        mainWindow = new BrowserWindow({
            title: "trackmebaby",
            url,
            rpc,
            // hiddenInset causes double titlebars and potential crashes on some Linux setups
            titleBarStyle: isLinux ? "default" : "hiddenInset",
            // Transparency on Linux can cause GLX/OpenGL segmentation faults (0x0)
            transparent: !isLinux,
            styleMask: {
                Titled: true,
                Closable: true,
                Resizable: true,
                Miniaturizable: true,
            },
            frame: {
                width: 900,
                height: 700,
                x: 200,
                y: 200,
            },
        });

        mainWindow.on("close", () => {
            mainWindow = null;
        });
    } catch (err: unknown) {
        logger.error("failed to create window", { error: toErrorData(err) });
    } finally {
        isCreatingWindow = false;
    }
}

// --- System Tray ---
const tray = new Tray({
    title: "trackmebaby",
    width: 22,
    height: 22,
});

tray.setMenu([
    { type: "normal", label: "Show Dashboard", action: "show" },
    { type: "divider" },
    { type: "normal", label: "Quit", action: "quit" },
]);

// Handle tray menu clicks - both menu items and icon clicks fire "tray-clicked"
// with action field distinguishing them
function getTrayAction(event: unknown): string | undefined {
    if (typeof event !== "object" || event === null) return undefined;
    const maybeEvent = event as { data?: { action?: unknown } };
    const action = maybeEvent.data?.action;
    return typeof action === "string" ? action : undefined;
}

tray.on("tray-clicked", (event: unknown) => {
    const action = getTrayAction(event);
    if (action === "show") {
        createWindow();
    } else if (action === "quit") {
        shutdown();
    } else {
        // Tray icon clicked (no menu action) — show dashboard
        createWindow();
    }
});

// --- Start Background Services ---
async function startServices(): Promise<void> {
    const basePath = settingsService.getBasePath();
    if (basePath) {
        logger.info("scanning projects", { basePath });
        const projects = await scanner.scan(basePath);

        // Start file watcher for each project
        for (const project of projects) {
            await watcher.addProject(project.path);
        }

        // Start git tracker
        await gitTracker.startTracking(projects.map((p) => p.path));

        logger.info("tracking projects", { count: projects.length });
    } else {
        logger.info("no base path configured");
        createWindow();
    }
}

// --- Graceful Shutdown ---
function shutdown(): void {
    logger.info("shutting down");
    watcher.stopAll();
    gitTracker.stopTracking();
    closeDatabase();
    Utils.quit();
}

Electrobun.events.on("before-quit", async () => {
    watcher.stopAll();
    gitTracker.stopTracking();
    closeDatabase();
});

// --- Boot ---
logger.info("starting background daemon");
startServices().catch((err) => {
    logger.error("service startup error", { error: toErrorData(err) });
});
