import type { RefObject } from "react";
import type {
    ActivityEvent,
    ActivitySummary,
    GitHubData,
    GitSnapshot,
    Project,
    ProjectStats,
} from "../../../../shared/types.ts";
import GitPage from "../../git/GitPage.tsx";
import GitHubPage from "../../github/GitHubPage.tsx";
import WardenFeed from "../../warden/WardenFeed.tsx";
import OverviewPage from "../OverviewPage.tsx";
import AIOverview from "./AIOverview.tsx";

interface DashboardContentProps {
    project: Project;
    gitSnapshot?: GitSnapshot | null;
    projectStats?: ProjectStats | null;
    events: ActivityEvent[];
    activitySummary?: ActivitySummary[];
    todayEventCount: number;
    statsLoading?: boolean;
    statsLastUpdated?: string;
    onRefreshStats?: () => void;
    aiRefreshKey?: number;
    onCommitsClick: () => void;
    onGitHubClick: () => void;
    isGitHubAuthenticated: boolean;
    githubData: GitHubData | null | undefined;
    githubLoading: boolean;
    onGitHubSignIn: () => void;
    timelineRef?: RefObject<HTMLDivElement>;
    githubRef?: RefObject<HTMLDivElement>;
    activeView?: "overview" | "warden";
}

export default function DashboardContent({
    project,
    gitSnapshot,
    projectStats,
    events,
    activitySummary,
    todayEventCount,
    statsLoading = false,
    statsLastUpdated,
    onRefreshStats,
    aiRefreshKey,
    onCommitsClick,
    onGitHubClick,
    isGitHubAuthenticated,
    githubData,
    githubLoading,
    onGitHubSignIn,
    timelineRef,
    githubRef,
    activeView = "overview",
}: DashboardContentProps) {
    if (activeView === "warden") {
        return (
            <main className="flex-1 overflow-y-auto custom-scrollbar px-6 py-3">
                <WardenFeed projectId={project.id} />
            </main>
        );
    }

    return (
        <main className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 px-6 py-3">

            {/* ── TOP ROW: bento cells, full width stacked ── */}
            <div className="flex flex-col gap-3 shrink-0">

                {/* AI Pulse cell — owns its own card border */}
                <div>
                    <AIOverview
                        project={project}
                        gitSnapshot={gitSnapshot}
                        refreshKey={aiRefreshKey}
                        onRefreshStats={onRefreshStats}
                        statsLastUpdated={statsLastUpdated}
                    />
                </div>

                {/* Vitality bars cell */}
                <div className="rounded-2xl border border-mac-border bg-mac-surface/30 px-4 py-3">
                    <OverviewPage
                        project={project}
                        gitSnapshot={gitSnapshot}
                        projectStats={projectStats}
                        eventCount={todayEventCount}
                        events={events}
                        activitySummary={activitySummary}
                        isWidget={true}
                        onCommitsClick={onCommitsClick}
                        onGitHubClick={onGitHubClick}
                        isGitHubAuthenticated={isGitHubAuthenticated}
                        githubData={githubData}
                        githubLoading={githubLoading}
                        onGitHubSignIn={onGitHubSignIn}
                        statsLoading={statsLoading}
                        statsLastUpdated={statsLastUpdated}
                        onRefreshStats={onRefreshStats}
                    />
                </div>
            </div>

            {/* ── BOTTOM ROW: stretches to fill remaining space ── */}
            <div className="grid grid-cols-2 gap-3 pb-3">

                {/* Commit Timeline cell */}
                <div ref={timelineRef} className="rounded-2xl border border-mac-border bg-mac-surface/30 px-4 py-3">
                    <GitPage
                        gitSnapshot={gitSnapshot}
                        projectStats={projectStats}
                        statsLoading={statsLoading}
                        isWidget={true}
                        section="timeline"
                    />
                </div>

                {/* Remote Environment cell */}
                <div ref={githubRef} className="rounded-2xl border border-mac-border bg-mac-surface/30 px-4 py-3">
                    <GitHubPage
                        githubData={githubData}
                        githubLoading={githubLoading}
                        isGitHubAuthenticated={isGitHubAuthenticated}
                        isWidget={true}
                        section="environment"
                    />
                </div>
            </div>
        </main>
    );
}
