import { useEffect, useRef, useState } from "react";
import { toErrorData } from "../../shared/error.ts";
import { createLogger } from "../../shared/logger.ts";
import type { Settings } from "../../shared/types.ts";
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
    const [hasLoadedSettings, setHasLoadedSettings] = useState(false);
    const isFirstAutosave = useRef(true);

    useEffect(() => {
        loadSettings();
    }, []);

    // Auto-save settings when they change (debounced)
    useEffect(() => {
        if (!rpcApi || !hasLoadedSettings) return;
        if (isFirstAutosave.current) {
            isFirstAutosave.current = false;
            return;
        }

        const timer = setTimeout(async () => {
            setSaving(true);
            try {
                await rpcApi.updateSettings(settings);
            } catch (err: unknown) {
                logger.warn("auto-save failed", { error: toErrorData(err) });
            } finally {
                setSaving(false);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [hasLoadedSettings, settings]);

    async function loadSettings() {
        if (!rpcApi) return;
        try {
            const s = await rpcApi.getSettings();
            setSettings(s);
        } catch (err: unknown) {
            logger.error("failed to load settings", {
                error: toErrorData(err),
            });
        } finally {
            setHasLoadedSettings(true);
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

    return (
        <div className="p-8 max-w-2xl mx-auto">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-mac-text tracking-tight">
                        Settings
                    </h1>
                    <p className="text-mac-secondary text-sm mt-0.5">
                        Changes are saved automatically
                    </p>
                </div>
                {saving && (
                    <span className="text-xs text-mac-secondary">
                        Saving...
                    </span>
                )}
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
            </div>
        </div>
    );
}
