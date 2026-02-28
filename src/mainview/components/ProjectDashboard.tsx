import { useRef } from "react";
import type {
    ActivityEvent,
    ActivitySummary,
    GitSnapshot,
    Project,
    ProjectStats,
} from "../../shared/types.ts";
import { useGitHubIntegration } from "../hooks/useGitHubIntegration.ts";
import GitHubPage from "./pages/GitHubPage";
import GitPage from "./pages/GitPage";
import OverviewPage from "./pages/OverviewPage";
import WorktreeCard from "./ui/WorktreeCard.tsx";

interface ProjectDashboardProps {
    project: Project;
    gitSnapshot?: GitSnapshot | null;
    projectStats?: ProjectStats | null;
    events: ActivityEvent[];
    activitySummary?: ActivitySummary[];
    statsLoading?: boolean;
    statsLastUpdated?: string;
    onRefreshStats?: () => void;
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
    onBack,
    onNavigateToSettings,
}: ProjectDashboardProps) {
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

    const hasWorktrees = project.worktrees && project.worktrees.length > 1;
    const {
        isGitHubAuthenticated,
        githubData,
        githubLoading,
        handleGitHubSignIn,
    } = useGitHubIntegration(project.id);

    return (
        <div className="flex flex-col w-full h-full bg-mac-bg select-none">
            {/* Unified Dashboard Header */}
            <header className="h-16 bg-mac-bg border-b border-mac-border px-10 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-5">
                    <button
                        onClick={onBack}
                        className="w-8 h-8 rounded-lg bg-mac-surface border border-mac-border flex items-center justify-center hover:bg-mac-hover active:scale-95 group"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2.5}
                            className="w-4 h-4 text-mac-secondary group-hover:text-mac-text group-hover:-translate-x-0.5 transition-transform"
                        >
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                    </button>

                    <div>
                        <h1 className="text-[15px] font-bold text-mac-text leading-tight">
                            {project.name}
                        </h1>
                        <p className="text-[11px] text-mac-secondary font-mono truncate max-w-md">
                            {project.path}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {hasWorktrees && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider bg-mac-surface text-mac-secondary px-2.5 py-1 rounded border border-mac-border">
                            {project.worktrees.length} worktrees
                        </span>
                    )}
                </div>
            </header>

            {/* Worktree Cards — stacked horizontal row */}
            {hasWorktrees && (
                <div className="bg-mac-surface border-b border-mac-border px-10 py-3 shrink-0">
                    <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-1">
                        {project.worktrees.map((wt) => (
                            <WorktreeCard key={wt.path} worktree={wt} />
                        ))}
                    </div>
                </div>
            )}

            {/* Main Unified Content */}
            <main className="flex-1 overflow-y-auto custom-scrollbar p-10">
                <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column: Core Stats & Repo History (Span 8) */}
                    <div className="lg:col-span-8 order-2 lg:order-1 space-y-12">
                        {/* Git History Timeline */}
                        <section ref={timelineRef} className="scroll-mt-12">
                            <GitPage
                                gitSnapshot={gitSnapshot}
                                projectStats={projectStats}
                                statsLoading={statsLoading}
                                isWidget={true}
                                section="timeline"
                            />
                        </section>

                        {/* Working State (Local Environment) */}
                        <section>
                            <GitPage
                                gitSnapshot={gitSnapshot}
                                projectStats={projectStats}
                                statsLoading={statsLoading}
                                isWidget={true}
                                section="workstate"
                            />
                        </section>

                        {/* Remote Environment */}
                        <section ref={githubRef} className="scroll-mt-12">
                            <GitHubPage
                                githubData={githubData}
                                githubLoading={githubLoading}
                                isGitHubAuthenticated={isGitHubAuthenticated}
                                isWidget={true}
                                section="environment"
                            />
                        </section>
                    </div>

                    {/* Right Column: Insights & Surroundings (Span 4) */}
                    <div className="lg:col-span-4 order-1 lg:order-2 space-y-12">
                        {/* Project Vitality (Overview) */}
                        <section>
                            <OverviewPage
                                project={project}
                                gitSnapshot={gitSnapshot}
                                projectStats={projectStats}
                                eventCount={todayEventCount}
                                events={events}
                                activitySummary={activitySummary}
                                isWidget={true}
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
                                        : onNavigateToSettings ||
                                          handleGitHubSignIn
                                }
                                statsLoading={statsLoading}
                                statsLastUpdated={statsLastUpdated}
                                onRefreshStats={onRefreshStats}
                            />
                        </section>
                        {/* Contributors */}
                        <section>
                            <GitPage
                                gitSnapshot={gitSnapshot}
                                projectStats={projectStats}
                                statsLoading={statsLoading}
                                isWidget={true}
                                section="contributors"
                            />
                        </section>
                    </div>
                </div>
            </main>
        </div>
    );
}
