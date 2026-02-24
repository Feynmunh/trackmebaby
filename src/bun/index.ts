/**
 * trackmebaby — Main entry point
 *
 * Starts as a background daemon with system tray.
 * Tray click opens the dashboard window.
 * Closing the window returns to tray-only mode.
 */
import {
	BrowserWindow,
	Tray,
	Utils,
	Updater,
} from "electrobun/bun";
import Electrobun from "electrobun/bun";

import { getDatabase, closeDatabase } from "./db/database.ts";
import { SettingsService } from "./services/settings.ts";
import { WatcherService } from "./services/watcher.ts";
import { GitTrackerService } from "./services/git-tracker.ts";
import { ProjectScanner } from "./services/project-scanner.ts";
import { createRPC } from "./rpc/bridge.ts";

// --- Initialize core services ---
import { join } from "node:path";
import { mkdirSync } from "node:fs";

// Use Electrobun's userData path for the database
let dbPath: string | undefined;
try {
	const userData = Utils.paths.userData;
	if (userData) {
		mkdirSync(userData, { recursive: true });
		dbPath = join(userData, "trackmebaby.db");
	}
} catch { }

const db = getDatabase(dbPath);
const settingsService = new SettingsService(db);
const scanner = new ProjectScanner(db);
const watcher = new WatcherService(db, settingsService.getWatchDebounce());
const gitTracker = new GitTrackerService(db, settingsService.getPollInterval());

// --- Window Management ---
const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

let mainWindow: BrowserWindow | null = null;

// --- RPC (needs getMainWindow for window control handlers) ---
const rpc = createRPC(db, settingsService, scanner, gitTracker, () => mainWindow);

async function getMainViewUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel();
	if (channel === "dev") {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 2000);
			await fetch(DEV_SERVER_URL, { method: "HEAD", signal: controller.signal });
			clearTimeout(timeoutId);
			console.log(`[trackmebaby] HMR enabled: ${DEV_SERVER_URL}`);
			return DEV_SERVER_URL;
		} catch {
			// Dev server not running
		}
	}
	return "views://mainview/index.html";
}

// Guard to prevent race condition when creating windows
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
			titleBarStyle: "hiddenInset",
			transparent: true,
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
tray.on("tray-clicked", (e: any) => {
	const action = e.data?.action;
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
		console.log("[trackmebaby] No base path configured. Open Settings to get started.");
		createWindow();
	}
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
