import { useEffect, useRef, useState } from "react";
import { toErrorData } from "../../shared/error.ts";
import { createLogger } from "../../shared/logger.ts";
import type { Settings } from "../../shared/types.ts";
import { getGitHubAuthStatus, githubSignOut, githubStartAuth } from "../rpc";

const logger = createLogger("settings");

// Try to import RPC
let rpcApi: {
    getSettings: () => Promise<Settings>;
    updateSettings: (
        settings: Partial<Settings>,
    ) => Promise<{ success: boolean }>;
    scanProjects: (basePath: string) => Promise<any[]>;
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

    // GitHub auth state
    const [githubAuthenticated, setGithubAuthenticated] = useState(false);
    const [githubUsername, setGithubUsername] = useState<string | null>(null);
    const [githubLoading, setGithubLoading] = useState(false);
    const [githubMessage, setGithubMessage] = useState<string | null>(null);
    const pollRef = useRef<Timer | null>(null);

    useEffect(() => {
        loadSettings();
        checkGitHubAuth();

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [checkGitHubAuth, loadSettings]);

    function checkGitHubAuth() {
        getGitHubAuthStatus()
            .then(({ authenticated, username }) => {
                setGithubAuthenticated(authenticated);
                setGithubUsername(username ?? null);
            })
            .catch((err: unknown) => {
                logger.warn("github auth status failed", {
                    error: toErrorData(err),
                });
                setGithubAuthenticated(false);
            });
    }

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

    async function handleGitHubSignIn() {
        setGithubLoading(true);
        setGithubMessage(null);
        try {
            const result = await githubStartAuth();
            if (!result.success) {
                setGithubMessage(result.error || "Failed to start sign-in");
                setGithubLoading(false);
                setTimeout(() => setGithubMessage(null), 5000);
                return;
            }

            // Poll for auth completion (the OAuth flow happens in the browser)
            setGithubMessage("Waiting for GitHub authorization…");
            let attempts = 0;
            const maxAttempts = 60; // 60 * 2s = 120s

            pollRef.current = setInterval(async () => {
                attempts++;
                try {
                    const status = await getGitHubAuthStatus();
                    if (status.authenticated) {
                        // Success!
                        if (pollRef.current) clearInterval(pollRef.current);
                        pollRef.current = null;
                        setGithubAuthenticated(true);
                        setGithubUsername(status.username ?? null);
                        setGithubLoading(false);
                        setGithubMessage(null);
                    } else if (attempts >= maxAttempts) {
                        if (pollRef.current) clearInterval(pollRef.current);
                        pollRef.current = null;
                        setGithubLoading(false);
                        setGithubMessage(
                            "Sign-in timed out. Please try again.",
                        );
                        setTimeout(() => setGithubMessage(null), 5000);
                    }
                } catch (err: unknown) {
                    logger.warn("github auth poll failed", {
                        error: toErrorData(err),
                    });
                }
            }, 2000);
        } catch (err: unknown) {
            logger.warn("github sign-in failed", { error: toErrorData(err) });
            setGithubLoading(false);
            setGithubMessage("Failed to start sign-in");
            setTimeout(() => setGithubMessage(null), 5000);
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
                {/* Appearance */}
                <div className="bg-mac-surface rounded-xl shadow-mac overflow-hidden">
                    <div className="px-4 py-3 border-b border-mac-border">
                        <h2 className="text-[13px] font-semibold text-mac-text uppercase tracking-wide">
                            Appearance
                        </h2>
                    </div>
                    <div className="px-4 py-3 flex items-center justify-between">
                        <span className="text-[14px] text-mac-text">Theme</span>
                        <div className="flex bg-mac-bg rounded-lg p-0.5 gap-0.5">
                            <button
                                onClick={() => applyTheme("light")}
                                className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${
                                    theme === "light"
                                        ? "bg-mac-surface text-mac-text shadow-mac"
                                        : "text-mac-secondary hover:text-mac-text"
                                }`}
                            >
                                Light
                            </button>
                            <button
                                onClick={() => applyTheme("dark")}
                                className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${
                                    theme === "dark"
                                        ? "bg-mac-surface text-mac-text shadow-mac"
                                        : "text-mac-secondary hover:text-mac-text"
                                }`}
                            >
                                Dark
                            </button>
                        </div>
                    </div>
                </div>

                {/* GitHub Integration */}
                <div className="bg-mac-surface rounded-xl shadow-mac overflow-hidden">
                    <div className="px-4 py-3 border-b border-mac-border">
                        <h2 className="text-[13px] font-semibold text-mac-text uppercase tracking-wide">
                            GitHub
                        </h2>
                    </div>
                    <div className="px-4 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {/* GitHub Logo */}
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-mac-bg">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 16 16"
                                        fill="currentColor"
                                        className="w-5 h-5 text-mac-secondary"
                                    >
                                        <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
                                    </svg>
                                </div>
                                <div>
                                    {githubAuthenticated ? (
                                        <>
                                            <span className="text-[14px] text-mac-text font-medium">
                                                Signed in as{" "}
                                                <span className="text-mac-accent font-semibold">
                                                    {githubUsername ||
                                                        "unknown"}
                                                </span>
                                            </span>
                                            <p className="text-[12px] text-mac-secondary">
                                                Issues and pull requests are
                                                visible in dashboards
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-[14px] text-mac-text font-medium">
                                                GitHub Account
                                            </span>
                                            <p className="text-[12px] text-mac-secondary">
                                                Sign in to view issues and pull
                                                requests
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>
                            {githubAuthenticated ? (
                                <button
                                    id="settings-github-signout"
                                    onClick={async () => {
                                        await githubSignOut();
                                        setGithubAuthenticated(false);
                                        setGithubUsername(null);
                                    }}
                                    className="px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all active:scale-[0.98] bg-mac-bg hover:bg-red-500/10 hover:text-red-400 text-mac-secondary"
                                >
                                    Sign out
                                </button>
                            ) : (
                                <button
                                    id="settings-github-signin"
                                    onClick={handleGitHubSignIn}
                                    disabled={githubLoading}
                                    className="px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all active:scale-[0.98] bg-mac-bg hover:bg-mac-hover text-mac-text disabled:opacity-40"
                                >
                                    {githubLoading ? (
                                        <span className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full border-2 border-mac-text border-t-transparent animate-spin" />
                                            Waiting…
                                        </span>
                                    ) : (
                                        "Sign in with GitHub"
                                    )}
                                </button>
                            )}
                        </div>
                        {githubMessage && (
                            <p
                                className={`text-[12px] mt-3 ${githubAuthenticated ? "text-emerald-500" : "text-mac-secondary"}`}
                            >
                                {githubMessage}
                            </p>
                        )}
                    </div>
                </div>

                {/* Workspace */}
                <div className="bg-mac-surface rounded-xl shadow-mac overflow-hidden">
                    <div className="px-4 py-3 border-b border-mac-border">
                        <h2 className="text-[13px] font-semibold text-mac-text uppercase tracking-wide">
                            Workspace
                        </h2>
                    </div>
                    <div className="px-4 py-3">
                        <label className="block text-[14px] text-mac-text mb-1.5">
                            Base Directory
                        </label>
                        <p className="text-[12px] text-mac-secondary mb-2">
                            Root folder containing your tracked projects
                        </p>
                        <input
                            id="settings-base-path"
                            type="text"
                            value={settings.basePath || ""}
                            onChange={(e) =>
                                setSettings({
                                    ...settings,
                                    basePath: e.target.value,
                                })
                            }
                            placeholder="/home/user/projects"
                            className="w-full bg-mac-bg rounded-lg px-3 py-2 text-[14px] text-mac-text placeholder-mac-secondary focus:ring-2 focus:ring-mac-accent/30 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* AI Configuration */}
                <div className="bg-mac-surface rounded-xl shadow-mac overflow-hidden">
                    <div className="px-4 py-3 border-b border-mac-border">
                        <h2 className="text-[13px] font-semibold text-mac-text uppercase tracking-wide">
                            AI Configuration
                        </h2>
                    </div>
                    <div className="divide-y divide-mac-border">
                        <div className="px-4 py-3 flex items-center justify-between">
                            <span className="text-[14px] text-mac-text">
                                Provider
                            </span>
                            <select
                                id="settings-ai-provider"
                                value={settings.aiProvider}
                                onChange={(e) =>
                                    setSettings({
                                        ...settings,
                                        aiProvider: e.target.value,
                                    })
                                }
                                className="bg-mac-bg rounded-lg px-3 py-1.5 text-[14px] text-mac-text focus:ring-2 focus:ring-mac-accent/30 outline-none appearance-none pr-8"
                            >
                                <option value="groq">Groq (Free Tier)</option>
                                <option value="openai">OpenAI</option>
                            </select>
                        </div>
                        <div className="px-4 py-3 flex items-center justify-between gap-4">
                            <span className="text-[14px] text-mac-text shrink-0">
                                Model
                            </span>
                            <input
                                id="settings-model"
                                type="text"
                                value={settings.aiModel}
                                onChange={(e) =>
                                    setSettings({
                                        ...settings,
                                        aiModel: e.target.value,
                                    })
                                }
                                placeholder="llama-3.3-70b-versatile"
                                className="bg-mac-bg rounded-lg px-3 py-1.5 text-[14px] text-mac-text text-right placeholder-mac-secondary focus:ring-2 focus:ring-mac-accent/30 outline-none w-64"
                            />
                        </div>
                        <div className="px-4 py-3">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[14px] text-mac-text">
                                    API Key
                                </span>
                            </div>
                            <p className="text-[12px] text-mac-secondary mb-2">
                                Set via{" "}
                                <code className="bg-mac-bg px-1.5 py-0.5 rounded text-[11px]">
                                    GROQ_API_KEY
                                </code>{" "}
                                env var, or enter below
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
                        <h2 className="text-[13px] font-semibold text-mac-text uppercase tracking-wide">
                            Performance
                        </h2>
                    </div>
                    <div className="divide-y divide-mac-border">
                        <div className="px-4 py-3 flex items-center justify-between">
                            <span className="text-[14px] text-mac-text">
                                Git Poll Interval (s)
                            </span>
                            <input
                                id="settings-poll-interval"
                                type="number"
                                value={settings.pollInterval / 1000}
                                onChange={(e) =>
                                    setSettings({
                                        ...settings,
                                        pollInterval:
                                            parseInt(e.target.value, 10) * 1000,
                                    })
                                }
                                min={30}
                                className="bg-mac-bg rounded-lg px-3 py-1.5 text-[14px] text-mac-text text-right focus:ring-2 focus:ring-mac-accent/30 outline-none w-24"
                            />
                        </div>
                        <div className="px-4 py-3 flex items-center justify-between">
                            <span className="text-[14px] text-mac-text">
                                File Watcher Debounce (ms)
                            </span>
                            <input
                                id="settings-debounce"
                                type="number"
                                value={settings.watchDebounce}
                                onChange={(e) =>
                                    setSettings({
                                        ...settings,
                                        watchDebounce: parseInt(
                                            e.target.value,
                                            10,
                                        ),
                                    })
                                }
                                min={100}
                                className="bg-mac-bg rounded-lg px-3 py-1.5 text-[14px] text-mac-text text-right focus:ring-2 focus:ring-mac-accent/30 outline-none w-24"
                            />
                        </div>
                    </div>
                </div>

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
