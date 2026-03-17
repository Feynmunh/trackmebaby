import { mkdirSync } from "node:fs";
// --- Initialize core services ---
import { join } from "node:path";
import Electrobun, {
    BrowserWindow,
    Tray,
    Updater,
    Utils,
} from "electrobun/bun";
/**
 * trackmebaby — Main entry point
 *
 * Starts as a background daemon with system tray.
 * Tray click opens the dashboard window.
 * Closing the window returns to tray-only mode.
 */
import type { WardenInsight } from "../shared/types.ts";
import { closeDatabase, getDatabase } from "./db/database.ts";
import { createRPC } from "./rpc/bridge.ts";
import { AISecretStore } from "./services/ai/index.ts";
import { GitTrackerService } from "./services/git-tracker.ts";
import { ProjectScanner } from "./services/project-scanner.ts";
import { SettingsService } from "./services/settings.ts";
import { WardenService } from "./services/warden.ts";
import { WatcherService } from "./services/watcher.ts";

// Use Electrobun's userData path for the database
let dbPath: string | undefined;
try {
    const userData = Utils.paths.userData;
    if (userData) {
        mkdirSync(userData, { recursive: true });
        dbPath = join(userData, "trackmebaby.db");
    }
} catch {}

const db = getDatabase(dbPath);
const settingsService = new SettingsService(db);
const aiSecretStore = new AISecretStore(db);
const scanner = new ProjectScanner(db);
const watcher = new WatcherService(db, settingsService.getWatchDebounce());
const gitTracker = new GitTrackerService(db, settingsService.getPollInterval());
let onWardenInsights:
    | ((projectId: string, insights: WardenInsight[]) => void)
    | undefined;
let onWardenAnalysisFailed:
    | ((projectId: string, reason: string) => void)
    | undefined;
const wardenService = new WardenService(
    db,
    settingsService,
    (projectId, insights) => {
        onWardenInsights?.(projectId, insights);
    },
    (projectId, reason) => {
        onWardenAnalysisFailed?.(projectId, reason);
    },
    aiSecretStore,
);

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
    wardenService,
    aiSecretStore,
    () => mainWindow,
);

onWardenInsights = (projectId, insights) => {
    try {
        rpc.send.wardenInsightsUpdated({ projectId, insights });
    } catch (err) {
        console.error("[trackmebaby] Failed to push warden insights:", err);
    }
};
onWardenAnalysisFailed = (projectId, reason) => {
    try {
        rpc.send.wardenAnalysisFailed({ projectId, reason });
    } catch (err) {
        console.error("[trackmebaby] Failed to push warden failure:", err);
    }
};

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
            console.log(`[trackmebaby] HMR enabled: ${DEV_SERVER_URL}`);
            return DEV_SERVER_URL;
        } catch {
            // Dev server not running
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
    } catch (err) {
        console.error("[trackmebaby] Failed to create window:", err);
    } finally {
        isCreatingWindow = false;
    }
}

// --- System Tray ---
const tray = new Tray({
    title: "trackmebaby",
    width: 22,
    height: 22,
    image: "views://assets/trackmebaby.png",
    template: false,
});

tray.setMenu([
    { type: "normal", label: "Show Dashboard", action: "show" },
    { type: "divider" },
    { type: "normal", label: "Quit", action: "quit" },
]);

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
        console.log(`[trackmebaby] Scanning projects in: ${basePath}`);
        const projects = await scanner.scan(basePath);

        // Start file watcher for each project
        for (const project of projects) {
            await watcher.addProject(project.path);
        }

        // Start git tracker
        await gitTracker.startTracking(projects.map((p) => p.path));

        console.log(`[trackmebaby] Tracking ${projects.length} projects`);
    } else {
        console.log(
            "[trackmebaby] No base path configured. Open Settings to get started.",
        );
    }
    // Always open the dashboard on startup
    createWindow();
}

// --- Graceful Shutdown ---
function shutdown(): void {
    console.log("[trackmebaby] Shutting down...");
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
console.log("[trackmebaby] Starting background daemon...");
startServices().catch((err) => {
    console.error("[trackmebaby] Service startup error:", err);
});
