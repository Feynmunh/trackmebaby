import { useEffect, useState } from "react";
import { toErrorData } from "../../shared/error.ts";
import { createLogger } from "../../shared/logger.ts";
import type { Project, Settings } from "../../shared/types.ts";
import AIConfigSection from "./settings/AIConfigSection.tsx";
import AppearanceSection from "./settings/AppearanceSection.tsx";
import GitHubAuthSection from "./settings/GitHubAuthSection.tsx";
import PerformanceSection from "./settings/PerformanceSection.tsx";
import WorkspaceSection from "./settings/WorkspaceSection.tsx";

const logger = createLogger("settings");

// Try to import RPC
let rpcApi: {
    getSettings: () => Promise<Settings>;
    updateSettings: (
        settings: Partial<Settings>,
    ) => Promise<{ success: boolean }>;
    scanProjects: (basePath: string) => Promise<Project[]>;
} | null = null;

try {
    rpcApi = await import("../rpc.ts");
} catch (err: unknown) {
    logger.warn("rpc not available", { error: toErrorData(err) });
}

export default function SettingsPanel() {
    const [settings, setSettings] = useState<Settings>({
        basePath: null,
        aiProvider: "groq",
        aiModel: "llama-3.3-70b-versatile",
        pollInterval: 60000,
        watchDebounce: 500,
    });
    const [theme, setTheme] = useState<"light" | "dark">(
        () =>
            (localStorage.getItem("trackmebaby-theme") as "light" | "dark") ||
            "dark",
    );
    const [apiKey, setApiKey] = useState("");
    const [saving, setSaving] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [scanResult, setScanResult] = useState<string | null>(null);
    const [saveResult, setSaveResult] = useState<string | null>(null);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    async function loadSettings() {
        if (!rpcApi) return;
        try {
            const s = await rpcApi.getSettings();
            setSettings(s);
        } catch (err: unknown) {
            logger.error("failed to load settings", {
                error: toErrorData(err),
            });
        }
    }

    function applyTheme(newTheme: "light" | "dark") {
        setTheme(newTheme);
        localStorage.setItem("trackmebaby-theme", newTheme);
        if (newTheme === "dark") {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
    }

    async function saveSettings() {
        if (!rpcApi) return;
        setSaving(true);
        setSaveResult(null);
        try {
            await rpcApi.updateSettings(settings);
            setSaveResult("Settings saved");
            setTimeout(() => setSaveResult(null), 2000);
        } catch (err: unknown) {
            logger.warn("failed to save settings", { error: toErrorData(err) });
            setSaveResult("Failed to save");
        } finally {
            setSaving(false);
        }
    }

    async function handleScan() {
        if (!rpcApi || !settings.basePath) return;
        setScanning(true);
        setScanResult(null);
        try {
            const projects = await rpcApi.scanProjects(settings.basePath);
            setScanResult(
                `Found ${projects.length} project${projects.length !== 1 ? "s" : ""}`,
            );
            setTimeout(() => setScanResult(null), 3000);
        } catch (err: unknown) {
            logger.warn("scan failed", { error: toErrorData(err) });
            setScanResult("Scan failed");
        } finally {
            setScanning(false);
        }
    }

    return (
        <div className="p-8 max-w-2xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-semibold text-mac-text tracking-tight">
                    Settings
                </h1>
                <p className="text-mac-secondary text-sm mt-0.5">
                    Configure your trackmebaby workspace
                </p>
            </div>

            <div className="space-y-5 pb-8">
                <AppearanceSection theme={theme} onApplyTheme={applyTheme} />
                <GitHubAuthSection />
                <WorkspaceSection settings={settings} onChange={setSettings} />
                <AIConfigSection
                    settings={settings}
                    apiKey={apiKey}
                    onSettingsChange={setSettings}
                    onApiKeyChange={setApiKey}
                />
                <PerformanceSection
                    settings={settings}
                    onChange={setSettings}
                />

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                    <button
                        id="settings-scan"
                        onClick={handleScan}
                        disabled={scanning || !settings.basePath}
                        className="px-4 py-2 bg-mac-bg hover:bg-mac-hover disabled:opacity-40 text-mac-text text-[14px] font-medium rounded-lg transition-all flex items-center gap-2"
                    >
                        {scanning ? (
                            <>
                                <div className="w-3.5 h-3.5 rounded-full border-2 border-mac-text border-t-transparent animate-spin" />
                                Scanning...
                            </>
                        ) : (
                            scanResult || "Scan Projects"
                        )}
                    </button>
                    <div className="flex-1" />
                    <button
                        id="settings-save"
                        onClick={saveSettings}
                        disabled={saving}
                        className="px-5 py-2 bg-mac-accent hover:opacity-90 disabled:opacity-40 text-white text-[14px] font-medium rounded-lg transition-all active:scale-[0.98] min-w-[120px]"
                    >
                        {saving ? "Saving..." : saveResult || "Save Settings"}
                    </button>
                </div>
            </div>
        </div>
    );
}
