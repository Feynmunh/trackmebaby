import { useEffect, useState } from "react";
import TabBar from "./components/TabBar";
import { ToastProvider } from "./components/ui/Toast.tsx";
import AITab from "./features/ai/AITab.tsx";
import SettingsPanel from "./features/settings/SettingsPanel.tsx";
import { getPlatform } from "./rpc";
import CardsTab from "./tabs/CardsTab";

type TabId = "cards" | "ai" | "settings";
type Theme = "light" | "dark" | "system";

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

const AISidebarIcon = ({ size = 20 }: { size?: number }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        width={size}
        height={size}
    >
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Z" />
        <path d="M12 8v8" />
        <path d="M8 12h8" />
    </svg>
);

function App() {
    const [activeTab, setActiveTab] = useState<TabId>("cards");
    const [isMac, setIsMac] = useState(true);
    const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(400);

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
            if (isDark) root.classList.add("dark");
            else root.classList.remove("dark");
        };
        updateTheme();
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleSystemChange = () => {
            const currentTheme = localStorage.getItem(
                "trackmebaby-theme",
            ) as Theme;
            if (!currentTheme || currentTheme === "system") updateTheme();
        };
        mediaQuery.addEventListener("change", handleSystemChange);
        getPlatform()
            .then((platform) => setIsMac(platform === "darwin"))
            .catch(() => setIsMac(false));
        return () =>
            mediaQuery.removeEventListener("change", handleSystemChange);
    }, []);

    const startResize = (e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = sidebarWidth;
        const onMouseMove = (moveEvent: MouseEvent) => {
            const delta = startX - moveEvent.clientX;
            setSidebarWidth(Math.max(300, Math.min(800, startWidth + delta)));
        };
        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    };

    return (
        <ToastProvider>
            <div className="flex flex-col h-screen overflow-hidden bg-app-bg font-sans selection:bg-app-accent/20">
                {isMac && (
                    <div className="h-10 w-full shrink-0 flex items-center justify-center bg-app-bg border-b border-app-border/40 z-50 relative electrobun-webkit-app-region-drag">
                        <div className="w-20 shrink-0" />
                        <div className="flex-1 flex items-center justify-center">
                            <span className="text-[13px] font-semibold text-app-text-main/80 cursor-default select-none electrobun-webkit-app-region-no-drag">
                                trackmebaby
                            </span>
                        </div>
                        <div className="w-4 shrink-0" />
                    </div>
                )}

                <div className="flex flex-row flex-1 overflow-hidden relative">
                    <TabBar
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        tabs={tabs}
                        settingsId="settings"
                    />

                    <div className="flex-1 overflow-y-auto relative">
                        {activeTab === "cards" && (
                            <CardsTab
                                onNavigateToSettings={() =>
                                    setActiveTab("settings")
                                }
                            />
                        )}
                        {activeTab === "ai" && <AITab />}
                        {activeTab === "settings" && <SettingsPanel />}

                        {activeTab !== "ai" && (
                            <button
                                onClick={() =>
                                    setAiSidebarOpen((prev) => !prev)
                                }
                                title={`${aiSidebarOpen ? "Close" : "Open"} AI Assistant`}
                                className="absolute bottom-5 right-5 z-40 flex items-center justify-center w-10 h-10 rounded-full shadow-lg border transition-all duration-200 ease-out hover:scale-105 active:scale-95 focus:outline-none bg-app-surface text-app-text-muted border-app-border hover:text-app-accent hover:border-app-accent/40"
                            >
                                {aiSidebarOpen ? (
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
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                ) : (
                                    <AISidebarIcon size={18} />
                                )}
                            </button>
                        )}
                    </div>

                    {aiSidebarOpen && activeTab !== "ai" && (
                        <div
                            className="flex flex-row h-full shrink-0 border-l border-app-border"
                            style={{ width: sidebarWidth }}
                        >
                            <div
                                onMouseDown={startResize}
                                className="w-1 h-full cursor-col-resize hover:bg-app-accent/40 transition-colors shrink-0 group"
                            >
                                <div className="w-full h-full group-hover:bg-app-accent/30 transition-colors" />
                            </div>
                            <div className="flex flex-col flex-1 overflow-hidden bg-app-bg">
                                <div className="flex items-center justify-between px-3 py-2 border-b border-app-border/60 shrink-0 bg-app-surface-elevated">
                                    <div className="flex items-center gap-2 text-app-text-main">
                                        <AISidebarIcon size={14} />
                                        <span className="text-[12px] font-semibold tracking-wide">
                                            AI Assistant
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => setAiSidebarOpen(false)}
                                        className="flex items-center justify-center w-5 h-5 rounded text-app-text-muted hover:text-app-text-main hover:bg-app-hover transition-colors"
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
                                <div className="flex-1 overflow-hidden">
                                    <AITab />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </ToastProvider>
    );
}

export default App;
