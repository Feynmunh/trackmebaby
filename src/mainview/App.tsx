import { useEffect, useRef, useState } from "react";
import { SwipeIndicator } from "./components/SwipeIndicator.tsx";
import TabBar from "./components/TabBar";
import AITab from "./features/ai/AITab.tsx";
import SettingsPanel from "./features/settings/SettingsPanel.tsx";
import { useSwipeGesture } from "./hooks/useSwipeGesture.ts";
import { getPlatform } from "./rpc";
import CardsTab from "./tabs/CardsTab";

/** Max pixel drag offset applied to the content during live swipe */
const DRAG_MAX_PX = 80;

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
    // Live drag progress: -1 (full left) to 1 (full right), 0 = idle
    const [swipeProgress, setSwipeProgress] = useState(0);
    // "snapping-back" = fingers lifted without committing — spring back to 0
    const [snapBack, setSnapBack] = useState(false);
    // true for one render-cycle after a swipe commits — triggers the pop burst
    const [swipeCommitted, setSwipeCommitted] = useState(false);
    const appRef = useRef<HTMLDivElement>(null);

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

        // Detect platform — custom titlebar only shown on macOS
        // On Windows, hiddenInset shows the native titlebar which handles
        // window controls (minimize, maximize, close, drag, resize)
        getPlatform()
            .then((platform) => setIsMac(platform === "darwin"))
            .catch(() => setIsMac(false));

        return () =>
            mediaQuery.removeEventListener("change", handleSystemChange);
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
        onSwiping: (progress) => {
            if (progress === 0) {
                // Fingers lifted — if we were mid-drag, snap back
                setSnapBack(true);
                setSwipeProgress(0);
                // Clear snap-back flag after spring animation finishes
                setTimeout(() => setSnapBack(false), 350);
            } else {
                setSnapBack(false);
                setSwipeProgress(progress);
            }
        },
        onSwipeRight: () => {
            setSwipeProgress(0);
            setSwipeCommitted(true);
            setTimeout(() => setSwipeCommitted(false), 400);
            navigateTab("left");
        },
        onSwipeLeft: () => {
            setSwipeProgress(0);
            setSwipeCommitted(true);
            setTimeout(() => setSwipeCommitted(false), 400);
            navigateTab("right");
        },
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
            className="flex flex-col h-screen overflow-hidden bg-app-bg font-sans selection:bg-app-accent/20"
        >
            {/* Custom Titlebar — macOS only (on Windows/Linux, the native titlebar handles this) */}
            {isMac && (
                <div className="h-10 w-full shrink-0 flex items-center justify-center bg-app-bg border-b border-app-border/40 z-50 relative electrobun-webkit-app-region-drag">
                    {/* Spacer for macOS traffic lights (left side) */}
                    <div className="w-20 shrink-0" />

                    {/* Centered title */}
                    <div className="flex-1 flex items-center justify-center">
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

                {/* Main content area */}
                <div className="flex-1 overflow-y-auto relative">
                    {/* Swipe edge indicator — arrow + glow that tracks drag progress */}
                    {!inDashboard && (
                        <SwipeIndicator
                            progress={swipeProgress}
                            committed={swipeCommitted}
                            canGoLeft={
                                SWIPEABLE_TABS.indexOf(
                                    activeTab as (typeof SWIPEABLE_TABS)[number],
                                ) > 0
                            }
                            canGoRight={
                                SWIPEABLE_TABS.indexOf(
                                    activeTab as (typeof SWIPEABLE_TABS)[number],
                                ) <
                                SWIPEABLE_TABS.length - 1
                            }
                        />
                    )}
                    {/* Tab content with slide animation keyed to trigger on each swipe */}
                    <div
                        key={animKey}
                        className={`h-full w-full ${slideClass}`}
                        style={{
                            // Live rubber-band drag: translate with diminishing returns
                            transform: snapBack
                                ? undefined
                                : swipeProgress !== 0
                                  ? `translateX(${swipeProgress * DRAG_MAX_PX}px) scale(${1 - Math.abs(swipeProgress) * 0.015})`
                                  : undefined,
                            // Spring back when fingers lift without committing
                            transition: snapBack
                                ? "transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1)"
                                : swipeProgress !== 0
                                  ? "none"
                                  : undefined,
                        }}
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
