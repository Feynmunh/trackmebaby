import type { MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import logoUrl from "../../assets/trackmebaby.png";
import TabBar from "./components/TabBar";
import { ToastProvider } from "./components/ui/Toast.tsx";
import { GitHubAuthProvider } from "./contexts/GitHubAuthContext.tsx";
import AITab from "./features/ai/AITab.tsx";
import SettingsPanel from "./features/settings/SettingsPanel.tsx";
import { getPlatform } from "./rpc";
import CardsTab from "./tabs/CardsTab";

type TabId = "cards" | "ai" | "settings";
type Theme = "light" | "dark" | "system";

/** Sparkle / Copilot-style icon for the AI sidebar toggle */
function AISidebarIcon({ size = 20 }: { size?: number }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            width={size}
            height={size}
        >
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
        </svg>
    );
}

const tabs = [
    {
        id: "cards",
        label: "Projects",
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-[22px] h-[22px]"
            >
                <rect x="3" y="3" width="7" height="7" rx="2" />
                <rect x="14" y="3" width="7" height="7" rx="2" />
                <rect x="3" y="14" width="7" height="7" rx="2" />
                <rect x="14" y="14" width="7" height="7" rx="2" />
            </svg>
        ),
    },
    {
        id: "ai",
        label: "AI Chat",
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-[22px] h-[22px]"
            >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
        ),
    },
] as const satisfies Array<{ id: TabId; label: string; icon: JSX.Element }>;

function App() {
    const [activeTab, setActiveTab] = useState<TabId>("cards");
    const [isMac, setIsMac] = useState(true); // default true to avoid flash
    const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(400);
    const isResizing = useRef(false);
    // Ref keeps keyboard handler stable without re-registering on every toggle
    const aiSidebarOpenRef = useRef(aiSidebarOpen);
    useEffect(() => {
        aiSidebarOpenRef.current = aiSidebarOpen;
    }, [aiSidebarOpen]);
    const [lastViewedProject, setLastViewedProject] = useState<{
        id: string;
        name: string;
    } | null>(null);

    const handleProjectView = useCallback(
        (projectId: string, projectName: string) => {
            setLastViewedProject({ id: projectId, name: projectName });
        },
        [],
    );

    const screenContext = useMemo(
        () => ({
            activeTab,
            selectedProjectId: lastViewedProject?.id ?? null,
            selectedProjectName: lastViewedProject?.name ?? null,
        }),
        [activeTab, lastViewedProject],
    );

    // Sidebar resize drag handler
    const startResize = useCallback(
        (e: MouseEvent) => {
            e.preventDefault();
            isResizing.current = true;
            const startX = e.clientX;
            const startWidth = sidebarWidth;

            const onMove = (ev: globalThis.MouseEvent) => {
                if (!isResizing.current) return;
                const delta = startX - ev.clientX;
                setSidebarWidth(
                    Math.min(700, Math.max(280, startWidth + delta)),
                );
            };
            const onUp = () => {
                isResizing.current = false;
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
        },
        [sidebarWidth],
    );

    useEffect(() => {
        const root = document.documentElement;

        const updateTheme = () => {
            const theme =
                (localStorage.getItem("trackmebaby-theme") as Theme) ||
                "system";
            let isDark = theme === "dark";

            if (theme === "system") {
                isDark = window.matchMedia(
                    "(prefers-color-scheme: dark)",
                ).matches;
            }

            if (isDark) {
                root.classList.add("dark");
            } else {
                root.classList.remove("dark");
            }
        };

        updateTheme();

        // Listen for system theme changes
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleSystemChange = () => {
            const currentTheme = localStorage.getItem(
                "trackmebaby-theme",
            ) as Theme;
            if (!currentTheme || currentTheme === "system") {
                updateTheme();
            }
        };

        mediaQuery.addEventListener("change", handleSystemChange);

        // Detect platform — custom titlebar only shown on macOS.
        // On Linux and Windows the backend uses titleBarStyle:"default" so the
        // OS-native titlebar (with minimize/maximize/close buttons) is shown; no
        // custom titlebar HTML is needed.
        getPlatform()
            .then((platform) => setIsMac(platform === "darwin"))
            .catch(() => setIsMac(false));

        return () => {
            mediaQuery.removeEventListener("change", handleSystemChange);
        };
    }, []);

    // Keyboard shortcut — separate effect so theme/platform setup runs only once
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Use toLowerCase() so Shift doesn't produce uppercase "C" on some platforms
            if (
                (e.metaKey || e.ctrlKey) &&
                e.shiftKey &&
                e.key.toLowerCase() === "c"
            ) {
                e.preventDefault();
                setAiSidebarOpen((prev) => !prev);
            }
            if (e.key === "Escape" && aiSidebarOpenRef.current) {
                setAiSidebarOpen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    return (
        <ToastProvider>
            <GitHubAuthProvider>
                <div className="flex flex-col h-screen overflow-hidden bg-app-bg font-sans selection:bg-app-accent/20">
                    {/* Custom Titlebar — macOS only (on Linux, the native titlebar handles this) */}
                    {isMac && (
                        <div className="h-10 w-full shrink-0 flex items-center justify-center bg-app-bg border-b border-app-border/40 z-50 relative electrobun-webkit-app-region-drag">
                            {/* Spacer for macOS traffic lights (left side) */}
                            <div className="w-20 shrink-0" />

                            {/* Centered title with icon */}
                            <div className="flex-1 flex items-center justify-center">
                                <img
                                    src={logoUrl}
                                    alt=""
                                    className="w-4 h-4 mr-1.5 select-none pointer-events-none"
                                    draggable={false}
                                />
                                <span className="text-[13px] font-semibold text-app-text-main/80 cursor-default select-none electrobun-webkit-app-region-no-drag">
                                    trackmebaby
                                </span>
                            </div>

                            {/* Right spacer to balance */}
                            <div className="w-4 shrink-0" />
                        </div>
                    )}

                    {/* Main Application Area */}
                    <div className="flex flex-row flex-1 overflow-hidden text-app-text-main">
                        {/* macOS-style translucent sidebar */}
                        <TabBar
                            activeTab={activeTab}
                            onTabChange={setActiveTab}
                            tabs={tabs}
                            settingsId="settings"
                        />

                        {/* Main content + AI sidebar split */}
                        <div className="flex flex-row flex-1 overflow-hidden relative">
                            {/* Main content area */}
                            <div className="flex-1 overflow-y-auto relative">
                                {activeTab === "cards" && (
                                    <CardsTab
                                        onNavigateToSettings={() =>
                                            setActiveTab("settings")
                                        }
                                        onProjectView={handleProjectView}
                                    />
                                )}
                                {activeTab === "ai" && (
                                    <AITab screenContext={screenContext} />
                                )}
                                {activeTab === "settings" && <SettingsPanel />}

                                {/* Floating AI Sidebar Toggle Button */}
                                {activeTab !== "ai" && (
                                    <button
                                        onClick={() =>
                                            setAiSidebarOpen((prev) => !prev)
                                        }
                                        title={`${aiSidebarOpen ? "Close" : "Open"} AI Assistant (⌘⇧C)`}
                                        className={[
                                            "absolute bottom-5 right-5 z-40",
                                            "flex items-center justify-center w-10 h-10 rounded-full",
                                            "shadow-lg border transition-all duration-200 ease-out",
                                            "hover:scale-105 active:scale-95 focus:outline-none",
                                            aiSidebarOpen
                                                ? "bg-app-accent text-white border-app-accent/60 shadow-app-accent/30"
                                                : "bg-app-surface text-app-text-muted border-app-border hover:text-app-accent hover:border-app-accent/40 hover:shadow-app-accent/20",
                                        ].join(" ")}
                                    >
                                        {aiSidebarOpen ? (
                                            /* X icon when open */
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth={2}
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                width={16}
                                                height={16}
                                            >
                                                <line
                                                    x1="18"
                                                    y1="6"
                                                    x2="6"
                                                    y2="18"
                                                />
                                                <line
                                                    x1="6"
                                                    y1="6"
                                                    x2="18"
                                                    y2="18"
                                                />
                                            </svg>
                                        ) : (
                                            <AISidebarIcon size={18} />
                                        )}
                                    </button>
                                )}
                            </div>

                            {/* AI Sidebar Panel */}
                            {aiSidebarOpen && activeTab !== "ai" && (
                                <div
                                    className="flex flex-row h-full shrink-0 border-l border-app-border"
                                    style={{ width: sidebarWidth }}
                                >
                                    {/* Drag Handle */}
                                    <div
                                        onMouseDown={startResize}
                                        className="w-1 h-full cursor-col-resize hover:bg-app-accent/40 transition-colors shrink-0 group"
                                    >
                                        <div className="w-full h-full group-hover:bg-app-accent/30 transition-colors" />
                                    </div>

                                    {/* Sidebar Content */}
                                    <div className="flex flex-col flex-1 overflow-hidden bg-app-bg">
                                        {/* Sidebar Header */}
                                        <div className="flex items-center justify-between px-3 py-2 border-b border-app-border/60 shrink-0 bg-app-surface-elevated">
                                            <div className="flex items-center gap-2 text-app-text-main">
                                                <AISidebarIcon size={14} />
                                                <span className="text-[12px] font-semibold tracking-wide">
                                                    AI Assistant
                                                </span>
                                            </div>
                                            <button
                                                onClick={() =>
                                                    setAiSidebarOpen(false)
                                                }
                                                className="flex items-center justify-center w-5 h-5 rounded text-app-text-muted hover:text-app-text-main hover:bg-app-hover transition-colors"
                                                title="Close (Esc)"
                                            >
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    width={13}
                                                    height={13}
                                                >
                                                    <line
                                                        x1="18"
                                                        y1="6"
                                                        x2="6"
                                                        y2="18"
                                                    />
                                                    <line
                                                        x1="6"
                                                        y1="6"
                                                        x2="18"
                                                        y2="18"
                                                    />
                                                </svg>
                                            </button>
                                        </div>

                                        {/* AITab rendered inside sidebar */}
                                        <div className="flex-1 overflow-hidden">
                                            <AITab
                                                screenContext={screenContext}
                                                isSidebar
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </GitHubAuthProvider>
        </ToastProvider>
    );
}

export default App;
