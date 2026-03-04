import { useRef, useState } from "react";
import type {
    ActivityEvent,
    ActivitySummary,
    GitSnapshot,
    Project,
    ProjectStats,
} from "../../../../shared/types.ts";
import { useGitHubIntegration } from "../../../hooks/useGitHubIntegration.ts";
import { useSwipeGesture } from "../../../hooks/useSwipeGesture.ts";
import DashboardContent from "../dashboard/DashboardContent.tsx";
import DashboardHeader from "../dashboard/DashboardHeader.tsx";
import WorktreeSection from "../dashboard/WorktreeSection.tsx";

interface ProjectDashboardProps {
    project: Project;
    gitSnapshot?: GitSnapshot | null;
    projectStats?: ProjectStats | null;
    events: ActivityEvent[];
    activitySummary?: ActivitySummary[];
    statsLoading?: boolean;
    statsLastUpdated?: string;
    onRefreshStats?: () => void;
    aiRefreshKey?: number;
    onBack: () => void;
    onNavigateToSettings?: () => void;
}

export default function ProjectDashboard({
    project,
    gitSnapshot,
    projectStats,
    events,
    activitySummary,
    statsLoading = false,
    statsLastUpdated,
    onRefreshStats,
    aiRefreshKey,
    onBack,
    onNavigateToSettings,
}: ProjectDashboardProps) {
    const [activeView, setActiveView] = useState<
        "overview" | "vault" | "warden"
    >("overview");
    // Slide direction for the dashboard view transition animation
    const [dashSlideDir, setDashSlideDir] = useState<"left" | "right" | null>(
        null,
    );
    const [dashAnimKey, setDashAnimKey] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const timelineRef = useRef<HTMLDivElement>(null);
    const githubRef = useRef<HTMLDivElement>(null);

    const DASHBOARD_VIEWS: Array<"overview" | "vault" | "warden"> = [
        "overview",
        "vault",
        "warden",
    ];

    const navigateDashboard = (direction: "left" | "right") => {
        // Block navigation if we're already transitioning
        if (isTransitioning) return;

        setIsTransitioning(true);
        // Clear the lock after animation completes (280ms animation + small buffer)
        setTimeout(() => setIsTransitioning(false), 350);

        setActiveView((current) => {
            const idx = DASHBOARD_VIEWS.indexOf(current);
            if (direction === "left") {
                // Swipe left → advance to next view (overview → vault → warden)
                if (idx >= DASHBOARD_VIEWS.length - 1) return current;
                setDashSlideDir("left");
                setDashAnimKey((k) => k + 1);
                return DASHBOARD_VIEWS[idx + 1];
            } else {
                // Swipe right → go back (warden → vault → overview → close)
                if (idx <= 0) {
                    onBack();
                    return current;
                }
                setDashSlideDir("right");
                setDashAnimKey((k) => k + 1);
                return DASHBOARD_VIEWS[idx - 1];
            }
        });
    };

    useSwipeGesture(containerRef, {
        threshold: 30,
        settleMs: 20,
        cooldownMs: 300,
        onSwipeLeft: () => navigateDashboard("right"),
        onSwipeRight: () => navigateDashboard("left"),
    });
    const getLocalDateKey = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    const summaryMap = new Map<string, number>();
    if (activitySummary) {
        for (const entry of activitySummary) {
            summaryMap.set(entry.date, entry.total);
        }
    }

    const todayKey = getLocalDateKey(new Date());
    const todayEventCount = activitySummary
        ? (summaryMap.get(todayKey) ?? 0)
        : events.filter((e) => {
              const d = new Date(e.timestamp);
              const now = new Date();
              return d.toDateString() === now.toDateString();
          }).length;

    const {
        isGitHubAuthenticated,
        githubData,
        githubLoading,
        handleGitHubSignIn,
    } = useGitHubIntegration(project.id);

    return (
        <div
            ref={containerRef}
            className="flex flex-col w-full h-full bg-app-bg select-none"
        >
            <DashboardHeader
                project={project}
                onBack={onBack}
                activeView={activeView}
                onViewChange={(view) => {
                    const oldIdx = DASHBOARD_VIEWS.indexOf(activeView);
                    const newIdx = DASHBOARD_VIEWS.indexOf(view);
                    setDashSlideDir(newIdx > oldIdx ? "left" : "right");
                    setDashAnimKey((k) => k + 1);
                    setActiveView(view);
                }}
            />
            <WorktreeSection worktrees={project.worktrees} />
            {/* Dashboard view slide animation — same spring curve as tab swipes */}
            <div
                key={dashAnimKey}
                className={`flex-1 overflow-hidden ${
                    dashSlideDir === "left"
                        ? "dash-slide-enter-from-right"
                        : dashSlideDir === "right"
                          ? "dash-slide-enter-from-left"
                          : ""
                }`}
            >
                <DashboardContent
                    project={project}
                    gitSnapshot={gitSnapshot}
                    projectStats={projectStats}
                    events={events}
                    activitySummary={activitySummary}
                    todayEventCount={todayEventCount}
                    statsLoading={statsLoading}
                    statsLastUpdated={statsLastUpdated}
                    onRefreshStats={onRefreshStats}
                    aiRefreshKey={aiRefreshKey}
                    activeView={activeView}
                    onCommitsClick={() =>
                        timelineRef.current?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                        })
                    }
                    onGitHubClick={() =>
                        githubRef.current?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                        })
                    }
                    isGitHubAuthenticated={isGitHubAuthenticated}
                    githubData={githubData}
                    githubLoading={githubLoading}
                    onGitHubSignIn={
                        isGitHubAuthenticated
                            ? handleGitHubSignIn
                            : onNavigateToSettings || handleGitHubSignIn
                    }
                    timelineRef={timelineRef}
                    githubRef={githubRef}
                />
            </div>
        </div>
    );
}
