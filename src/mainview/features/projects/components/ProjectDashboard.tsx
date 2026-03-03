import { useRef, useState } from "react";
import type {
    ActivityEvent,
    ActivitySummary,
    GitSnapshot,
    Project,
    ProjectStats,
} from "../../../../shared/types.ts";
import { useGitHubIntegration } from "../../../hooks/useGitHubIntegration.ts";
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
    const [activeView, setActiveView] = useState<"overview" | "warden">(
        "overview",
    );
    const timelineRef = useRef<HTMLDivElement>(null);
    const githubRef = useRef<HTMLDivElement>(null);
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
        <div className="flex flex-col w-full h-full bg-app-bg select-none">
            <DashboardHeader
                project={project}
                onBack={onBack}
                activeView={activeView}
                onViewChange={setActiveView}
            />
            <WorktreeSection worktrees={project.worktrees} />
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
    );
}
