import { useEffect, useRef, useState } from "react";
import { toErrorData } from "../../../shared/error.ts";
import { createLogger } from "../../../shared/logger.ts";
import type { Settings } from "../../../shared/types.ts";
import AppearanceSection from "./sections/AppearanceSection.tsx";
import GitHubAuthSection from "./sections/GitHubAuthSection.tsx";
import PerformanceSection from "./sections/PerformanceSection.tsx";
import WorkspaceSection from "./sections/WorkspaceSection.tsx";

const logger = createLogger("settings");

// Try to import RPC
let rpcApi: {
    getSettings: () => Promise<Settings>;
    updateSettings: (
        settings: Partial<Settings>,
    ) => Promise<{ success: boolean }>;
} | null = null;

try {
    rpcApi = await import("../../rpc.ts");
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
    const [theme, setTheme] = useState<"light" | "dark" | "system">(
        () =>
            (localStorage.getItem("trackmebaby-theme") as
                | "light"
                | "dark"
                | "system") || "system",
    );
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

    function applyTheme(newTheme: "light" | "dark" | "system") {
        const root = document.documentElement;

        // Apply transition guard
        root.classList.add("theme-switching");

        setTheme(newTheme);
        localStorage.setItem("trackmebaby-theme", newTheme);

        let isDark = newTheme === "dark";
        if (newTheme === "system") {
            isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        }

        if (isDark) {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }

        // Remove guard in next frames to ensure paint without transitions
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                root.classList.remove("theme-switching");
            });
        });
    }

    return (
        <div className="p-8 max-w-2xl mx-auto">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-app-text-main tracking-tight">
                        Settings
                    </h1>
                    <p className="text-app-text-muted text-sm mt-0.5">
                        Changes are saved automatically
                    </p>
                </div>
                {saving && (
                    <span className="text-xs text-app-text-muted">
                        Saving...
                    </span>
                )}
            </div>

            <div className="space-y-5 pb-8">
                <AppearanceSection theme={theme} onApplyTheme={applyTheme} />
                <GitHubAuthSection />
                <WorkspaceSection settings={settings} onChange={setSettings} />
                <PerformanceSection
                    settings={settings}
                    onChange={setSettings}
                />
            </div>
        </div>
    );
}
