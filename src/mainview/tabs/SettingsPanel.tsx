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
        <div className="p-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-white">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-xl font-bold text-white">Settings</h1>
                    <p className="text-sm text-gray-400">Configure trackmebaby</p>
                </div>
            </div>

            <div className="space-y-5">
                {/* Base Folder */}
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                    <label className="block text-sm font-medium text-gray-300 mb-1">Base Folder</label>
                    <p className="text-xs text-gray-500 mb-2">
                        Root folder containing your project directories
                    </p>
                    <input
                        id="settings-base-path"
                        type="text"
                        value={settings.basePath || ""}
                        onChange={(e) => setSettings({ ...settings, basePath: e.target.value })}
                        placeholder="/home/user/projects"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition"
                    />
                </div>

                {/* AI Provider */}
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                    <label className="block text-sm font-medium text-gray-300 mb-1">AI Provider</label>
                    <select
                        id="settings-ai-provider"
                        value={settings.aiProvider}
                        onChange={(e) => setSettings({ ...settings, aiProvider: e.target.value })}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition"
                    >
                        <option value="groq">Groq (Free Tier)</option>
                        <option value="openai">OpenAI</option>
                    </select>
                </div>

                {/* API Key */}
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                    <label className="block text-sm font-medium text-gray-300 mb-1">API Key</label>
                    <p className="text-xs text-gray-500 mb-2">
                        Set via <code className="text-gray-400">GROQ_API_KEY</code> environment variable, or enter here
                    </p>
                    <input
                        id="settings-api-key"
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter your API key"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition"
                    />
                </div>

                {/* Model */}
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                    <label className="block text-sm font-medium text-gray-300 mb-1">Model</label>
                    <input
                        id="settings-model"
                        type="text"
                        value={settings.aiModel}
                        onChange={(e) => setSettings({ ...settings, aiModel: e.target.value })}
                        placeholder="llama-3.3-70b-versatile"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition"
                    />
                </div>

                {/* Intervals */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                        <label className="block text-sm font-medium text-gray-300 mb-1">Poll Interval (s)</label>
                        <input
                            id="settings-poll-interval"
                            type="number"
                            value={settings.pollInterval / 1000}
                            onChange={(e) => setSettings({ ...settings, pollInterval: parseInt(e.target.value) * 1000 })}
                            min={30}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition"
                        />
                    </div>
                    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                        <label className="block text-sm font-medium text-gray-300 mb-1">Debounce (ms)</label>
                        <input
                            id="settings-debounce"
                            type="number"
                            value={settings.watchDebounce}
                            onChange={(e) => setSettings({ ...settings, watchDebounce: parseInt(e.target.value) })}
                            min={100}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition"
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        id="settings-save"
                        onClick={saveSettings}
                        disabled={saving}
                        className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 disabled:text-violet-400 text-white font-medium rounded-lg transition-colors text-sm"
                    >
                        {saving ? "Saving..." : saveResult || "Save Settings"}
                    </button>
                    <button
                        id="settings-scan"
                        onClick={handleScan}
                        disabled={scanning || !settings.basePath}
                        className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:text-gray-600 text-gray-300 font-medium rounded-lg transition-colors text-sm border border-gray-700"
                    >
                        {scanning ? "Scanning..." : scanResult || "Scan Projects"}
                    </button>
                </div>
            </div>
        </div>
    );
}
