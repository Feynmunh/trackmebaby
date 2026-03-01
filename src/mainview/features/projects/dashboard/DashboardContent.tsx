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
}: DashboardContentProps) {
    return (
        <main className="flex-1 overflow-y-auto custom-scrollbar">
            {/* ── CODE content ── */}
            <div className="px-12 pb-12 pt-6 max-w-[1600px] mx-auto">
                <AIOverview
                    project={project}
                    gitSnapshot={gitSnapshot}
                    refreshKey={aiRefreshKey}
                />

                <div className="grid grid-cols-2 gap-8 mt-8">
                    {/* Left — Summary */}
                    <div className="space-y-8">
                        <section>
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
                        </section>
                    </div>

                    {/* Right — Commit Graph + PR / Issues */}
                    <div className="space-y-8">
                        <section ref={timelineRef} className="scroll-mt-6">
                            <GitPage
                                gitSnapshot={gitSnapshot}
                                projectStats={projectStats}
                                statsLoading={statsLoading}
                                isWidget={true}
                                section="timeline"
                            />
                        </section>

                        <section ref={githubRef} className="scroll-mt-6">
                            <GitHubPage
                                githubData={githubData}
                                githubLoading={githubLoading}
                                isGitHubAuthenticated={isGitHubAuthenticated}
                                isWidget={true}
                                section="environment"
                            />
                        </section>
                    </div>
                </div>
            </div>
        </main>
    );
}
