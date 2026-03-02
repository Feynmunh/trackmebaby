import { useEffect, useRef, useState } from "react";
import TabBar from "./components/TabBar";
import AITab from "./features/ai/AITab.tsx";
import SettingsPanel from "./features/settings/SettingsPanel.tsx";
import { useSwipeGesture } from "./hooks/useSwipeGesture.ts";
import { getPlatform } from "./rpc";
import CardsTab from "./tabs/CardsTab";

type TabId = "cards" | "ai" | "settings";

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
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-[20px] h-[20px]"
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
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-[20px] h-[20px]"
            >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
        ),
    },
] as const satisfies Array<{ id: TabId; label: string; icon: JSX.Element }>;

// Ordered list of tabs for swipe navigation (settings excluded — it lives in
// the sidebar footer and is not part of the linear swipe sequence)
const SWIPEABLE_TABS: TabId[] = ["cards", "ai"];

function App() {
    const [activeTab, setActiveTab] = useState<TabId>("cards");
    const [isMac, setIsMac] = useState(true); // default true to avoid flash
    // Track swipe direction so we can apply the correct slide animation
    const [slideDirection, setSlideDirection] = useState<
        "left" | "right" | null
    >(null);
    const [animKey, setAnimKey] = useState(0); // bump to re-trigger animation
    const [inDashboard, setInDashboard] = useState(false);
    const appRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const savedTheme = localStorage.getItem("trackmebaby-theme") || "dark";
        if (savedTheme === "dark") {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }

        // Detect platform — custom titlebar only shown on macOS
        // On Windows, hiddenInset shows the native titlebar which handles
        // window controls (minimize, maximize, close, drag, resize)
        getPlatform()
            .then((platform) => setIsMac(platform === "darwin"))
            .catch(() => setIsMac(false));
    }, []);

    const navigateTab = (direction: "left" | "right") => {
        setActiveTab((current) => {
            const idx = SWIPEABLE_TABS.indexOf(
                current as (typeof SWIPEABLE_TABS)[number],
            );
            if (direction === "left") {
                if (idx === -1 || idx === SWIPEABLE_TABS.length - 1)
                    return current;
                setSlideDirection("left");
                setAnimKey((k) => k + 1);
                return SWIPEABLE_TABS[idx + 1];
            } else {
                if (idx <= 0) return current;
                setSlideDirection("right");
                setAnimKey((k) => k + 1);
                return SWIPEABLE_TABS[idx - 1];
            }
        });
    };

    // Swipe right → advance to next tab; swipe left → go to previous tab
    // Only navigates within SWIPEABLE_TABS (settings is excluded)
    // Disabled when the user is inside a project dashboard (CardsTab handles its own swipe there)
    useSwipeGesture(appRef, {
        enabled: !inDashboard,
        onSwipeRight: () => navigateTab("left"),
        onSwipeLeft: () => navigateTab("right"),
    });

    // Slide animation class — "left" swipe means new content enters from the right
    const slideClass =
        slideDirection === "left"
            ? "tab-slide-enter-from-right"
            : slideDirection === "right"
              ? "tab-slide-enter-from-left"
              : "";

    return (
        <div
            ref={appRef}
            className="flex flex-col h-screen overflow-hidden bg-mac-bg font-sans selection:bg-mac-accent/20"
        >
            {/* Custom Titlebar — macOS only (on Windows, the native titlebar handles this) */}
            {isMac && (
                <div className="h-10 w-full shrink-0 flex items-center justify-center bg-mac-bg border-b border-white/[0.05] z-50 relative electrobun-webkit-app-region-drag">
                    {/* Spacer for macOS traffic lights (left side) */}
                    <div className="w-20 shrink-0" />

                    {/* Centered title */}
                    <div className="flex-1 flex items-center justify-center">
                        <span className="text-[13px] font-semibold text-mac-text/80 cursor-default select-none electrobun-webkit-app-region-no-drag">
                            trackmebaby
                        </span>
                    </div>

                    {/* Right spacer to balance */}
                    <div className="w-4 shrink-0" />
                </div>
            )}

            {/* Main Application Area */}
            <div className="flex flex-row flex-1 overflow-hidden text-mac-text">
                {/* macOS-style translucent sidebar */}
                <TabBar
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    tabs={tabs}
                    settingsId="settings"
                />

                {/* Main content area */}
                <div className="flex-1 overflow-y-auto relative">
                    {/* Tab content with slide animation keyed to trigger on each swipe */}
                    <div
                        key={animKey}
                        className={`h-full w-full ${slideClass}`}
                    >
                        {activeTab === "cards" && (
                            <CardsTab
                                onNavigateToSettings={() =>
                                    setActiveTab("settings")
                                }
                                onDashboardStateChange={setInDashboard}
                            />
                        )}
                        {activeTab === "ai" && <AITab />}
                        {activeTab === "settings" && <SettingsPanel />}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;
