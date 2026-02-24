import { useState, useEffect } from "react";
import type { Settings } from "../../shared/types.ts";

// Try to import RPC
let rpcApi: {
    getSettings: () => Promise<Settings>;
    updateSettings: (settings: Partial<Settings>) => Promise<{ success: boolean }>;
    scanProjects: (basePath: string) => Promise<any[]>;
} | null = null;

try {
    rpcApi = await import("../rpc.ts");
} catch {
    // RPC not available
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
        () => (localStorage.getItem("trackmebaby-theme") as "light" | "dark") || "dark"
    );
    const [apiKey, setApiKey] = useState("");
    const [saving, setSaving] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [scanResult, setScanResult] = useState<string | null>(null);
    const [saveResult, setSaveResult] = useState<string | null>(null);

    useEffect(() => {
        loadSettings();
    }, []);

    async function loadSettings() {
        if (!rpcApi) return;
        try {
            const s = await rpcApi.getSettings();
            setSettings(s);
        } catch (err) {
            console.error("Failed to load settings:", err);
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
        } catch (err) {
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
            setScanResult(`Found ${projects.length} project${projects.length !== 1 ? "s" : ""}`);
            setTimeout(() => setScanResult(null), 3000);
        } catch (err) {
            setScanResult("Scan failed");
        } finally {
            setScanning(false);
        }
    }

    return (
        <div className="p-8 max-w-2xl mx-auto h-full flex flex-col">
            {/* Header */}
            <div className="mb-6 shrink-0">
                <h1 className="text-2xl font-semibold text-mac-text tracking-tight">Settings</h1>
                <p className="text-mac-secondary text-sm mt-0.5">Configure your trackmebaby workspace</p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-5 pb-8">
                {/* Appearance */}
                <div className="bg-mac-surface rounded-xl shadow-mac overflow-hidden">
                    <div className="px-4 py-3 border-b border-mac-border">
                        <h2 className="text-[13px] font-semibold text-mac-text uppercase tracking-wide">Appearance</h2>
                    </div>
                    <div className="px-4 py-3 flex items-center justify-between">
                        <span className="text-[14px] text-mac-text">Theme</span>
                        <div className="flex bg-mac-bg rounded-lg p-0.5 gap-0.5">
                            <button
                                onClick={() => applyTheme("light")}
                                className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${theme === "light"
                                        ? "bg-mac-surface text-mac-text shadow-mac"
                                        : "text-mac-secondary hover:text-mac-text"
                                    }`}
                            >
                                Light
                            </button>
                            <button
                                onClick={() => applyTheme("dark")}
                                className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${theme === "dark"
                                        ? "bg-mac-surface text-mac-text shadow-mac"
                                        : "text-mac-secondary hover:text-mac-text"
                                    }`}
                            >
                                Dark
                            </button>
                        </div>
                    </div>
                </div>

                {/* Workspace */}
                <div className="bg-mac-surface rounded-xl shadow-mac overflow-hidden">
                    <div className="px-4 py-3 border-b border-mac-border">
                        <h2 className="text-[13px] font-semibold text-mac-text uppercase tracking-wide">Workspace</h2>
                    </div>
                    <div className="px-4 py-3">
                        <label className="block text-[14px] text-mac-text mb-1.5">Base Directory</label>
                        <p className="text-[12px] text-mac-secondary mb-2">Root folder containing your tracked projects</p>
                        <input
                            id="settings-base-path"
                            type="text"
                            value={settings.basePath || ""}
                            onChange={(e) => setSettings({ ...settings, basePath: e.target.value })}
                            placeholder="/home/user/projects"
                            className="w-full bg-mac-bg rounded-lg px-3 py-2 text-[14px] text-mac-text placeholder-mac-secondary focus:ring-2 focus:ring-mac-accent/30 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* AI Configuration */}
                <div className="bg-mac-surface rounded-xl shadow-mac overflow-hidden">
                    <div className="px-4 py-3 border-b border-mac-border">
                        <h2 className="text-[13px] font-semibold text-mac-text uppercase tracking-wide">AI Configuration</h2>
                    </div>
                    <div className="divide-y divide-mac-border">
                        <div className="px-4 py-3 flex items-center justify-between">
                            <span className="text-[14px] text-mac-text">Provider</span>
                            <select
                                id="settings-ai-provider"
                                value={settings.aiProvider}
                                onChange={(e) => setSettings({ ...settings, aiProvider: e.target.value })}
                                className="bg-mac-bg rounded-lg px-3 py-1.5 text-[14px] text-mac-text focus:ring-2 focus:ring-mac-accent/30 outline-none appearance-none pr-8"
                            >
                                <option value="groq">Groq (Free Tier)</option>
                                <option value="openai">OpenAI</option>
                            </select>
                        </div>
                        <div className="px-4 py-3 flex items-center justify-between gap-4">
                            <span className="text-[14px] text-mac-text shrink-0">Model</span>
                            <input
                                id="settings-model"
                                type="text"
                                value={settings.aiModel}
                                onChange={(e) => setSettings({ ...settings, aiModel: e.target.value })}
                                placeholder="llama-3.3-70b-versatile"
                                className="bg-mac-bg rounded-lg px-3 py-1.5 text-[14px] text-mac-text text-right placeholder-mac-secondary focus:ring-2 focus:ring-mac-accent/30 outline-none w-64"
                            />
                        </div>
                        <div className="px-4 py-3">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[14px] text-mac-text">API Key</span>
                            </div>
                            <p className="text-[12px] text-mac-secondary mb-2">
                                Set via <code className="bg-mac-bg px-1.5 py-0.5 rounded text-[11px]">GROQ_API_KEY</code> env var, or enter below
                            </p>
                            <input
                                id="settings-api-key"
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Enter API key"
                                className="w-full bg-mac-bg rounded-lg px-3 py-2 text-[14px] text-mac-text placeholder-mac-secondary focus:ring-2 focus:ring-mac-accent/30 outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Performance */}
                <div className="bg-mac-surface rounded-xl shadow-mac overflow-hidden">
                    <div className="px-4 py-3 border-b border-mac-border">
                        <h2 className="text-[13px] font-semibold text-mac-text uppercase tracking-wide">Performance</h2>
                    </div>
                    <div className="divide-y divide-mac-border">
                        <div className="px-4 py-3 flex items-center justify-between">
                            <span className="text-[14px] text-mac-text">Git Poll Interval (s)</span>
                            <input
                                id="settings-poll-interval"
                                type="number"
                                value={settings.pollInterval / 1000}
                                onChange={(e) => setSettings({ ...settings, pollInterval: parseInt(e.target.value) * 1000 })}
                                min={30}
                                className="bg-mac-bg rounded-lg px-3 py-1.5 text-[14px] text-mac-text text-right focus:ring-2 focus:ring-mac-accent/30 outline-none w-24"
                            />
                        </div>
                        <div className="px-4 py-3 flex items-center justify-between">
                            <span className="text-[14px] text-mac-text">File Watcher Debounce (ms)</span>
                            <input
                                id="settings-debounce"
                                type="number"
                                value={settings.watchDebounce}
                                onChange={(e) => setSettings({ ...settings, watchDebounce: parseInt(e.target.value) })}
                                min={100}
                                className="bg-mac-bg rounded-lg px-3 py-1.5 text-[14px] text-mac-text text-right focus:ring-2 focus:ring-mac-accent/30 outline-none w-24"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions footer */}
            <div className="flex gap-3 pt-4 border-t border-mac-border shrink-0 mt-auto">
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
                        <>{scanResult || "Scan Projects"}</>
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
    );
}
