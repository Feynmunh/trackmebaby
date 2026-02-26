import { useEffect, useState } from "react";
import { timeAgo } from "../../../shared/time.ts";
import type {
    ActivityEvent,
    ActivitySummary,
    GitHubData,
    GitSnapshot,
    Project,
    ProjectStats,
} from "../../../shared/types.ts";

interface OverviewPageProps {
    project: Project;
    gitSnapshot?: GitSnapshot | null;
    projectStats?: ProjectStats | null;
    eventCount: number;
    events: ActivityEvent[];
    activitySummary?: ActivitySummary[];
    isWidget?: boolean;
    onGitHubClick?: () => void;
    onCommitsClick?: () => void;
    isGitHubAuthenticated?: boolean;
    githubData?: GitHubData | null;
    githubLoading?: boolean;
    onGitHubSignIn?: () => void;
    statsLoading?: boolean;
    statsLastUpdated?: string;
    onRefreshStats?: () => void;
}

/** GitHub Octicon: IssueOpened (circle-dot) */
function IssueIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className={className}
        >
            <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
            <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" />
        </svg>
    );
}

/** GitHub Octicon: GitPullRequest */
function PullRequestIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className={className}
        >
            <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
        </svg>
    );
}

function getVitalityStatus(
    project: Project,
    eventCount: number,
    gitSnapshot?: GitSnapshot | null,
): { label: string; colorClass: string; bgClass: string } {
    const lastActivity = project.lastActivityAt
        ? new Date(project.lastActivityAt)
        : null;
    const hoursSinceActivity = lastActivity
        ? (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60)
        : Infinity;

    if (
        eventCount > 0 ||
        (gitSnapshot?.uncommittedCount ?? 0) > 0 ||
        hoursSinceActivity < 24
    ) {
        return {
            label: "Active",
            colorClass: "text-blue-400",
            bgClass: "bg-blue-500/10",
        };
    }
    if (hoursSinceActivity < 24 * 7) {
        return {
            label: "Idle",
            colorClass: "text-amber-400",
            bgClass: "bg-amber-500/10",
        };
    }
    return {
        label: "Dormant",
        colorClass: "text-mac-secondary",
        bgClass: "bg-mac-border/40",
    };
}

/** GitHub sign-in prompt shown inside a card when not authenticated */
function GitHubSignInPrompt({
    onClick,
    loading,
}: {
    onClick?: () => void;
    loading?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            disabled={loading}
            className="w-full text-left group/signin"
        >
            <div className="flex items-center gap-1.5 mt-1">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="w-3 h-3 text-mac-secondary opacity-60"
                >
                    <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
                </svg>
                <span className="text-[10px] font-semibold text-mac-secondary group-hover/signin:text-mac-text transition-colors">
                    {loading ? "Signing in…" : "Sign in to access"}
                </span>
            </div>
        </button>
    );
}

export default function OverviewPage({
    project,
    gitSnapshot,
    projectStats,
    eventCount,
    events,
    activitySummary,
    isWidget = false,
    onGitHubClick,
    onCommitsClick,
    isGitHubAuthenticated = false,
    githubData = null,
    githubLoading = false,
    onGitHubSignIn,
    statsLoading = false,
    statsLastUpdated,
    onRefreshStats,
}: OverviewPageProps) {
    const [showingBranches, setShowingBranches] = useState(false);
    const [, forceRender] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            forceRender((n) => n + 1);
        }, 60000);
        return () => clearInterval(timer);
    }, []);

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

    if (isWidget) {
        const dailyCounts = Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dayKey = getLocalDateKey(date);
            const count = activitySummary
                ? (summaryMap.get(dayKey) ?? 0)
                : events.filter(
                      (e) =>
                          new Date(e.timestamp).toDateString() ===
                          date.toDateString(),
                  ).length;
            return { day: date.toDateString().slice(0, 3), count };
        }).reverse();

        const maxCount = Math.max(...dailyCounts.map((d) => d.count), 1);
        const vitality = getVitalityStatus(project, eventCount, gitSnapshot);

        return (
            <div className="space-y-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-mac-secondary uppercase tracking-[0.2em]">
                        Project Vitality
                    </h2>
                    <div className="flex items-center gap-3">
                        {statsLastUpdated && (
                            <span className="text-[10px] font-bold text-mac-secondary uppercase tracking-widest opacity-60">
                                Updated{" "}
                                {timeAgo(statsLastUpdated, {
                                    emptyLabel: "never",
                                    justNowLabel: "just now",
                                    maxDays: Number.POSITIVE_INFINITY,
                                })}
                            </span>
                        )}
                        {onRefreshStats && (
                            <button
                                onClick={onRefreshStats}
                                className="px-2.5 py-1 rounded-full border border-mac-border/40 bg-mac-surface/50 text-[9px] font-black uppercase tracking-widest text-mac-secondary hover:text-mac-accent hover:border-mac-accent/40 transition-colors"
                            >
                                Refresh
                            </button>
                        )}
                        <span
                            className={`text-[10px] font-bold ${vitality.colorClass} ${vitality.bgClass} px-2 py-0.5 rounded uppercase tracking-widest`}
                        >
                            {vitality.label}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-6">
                        {/* Branches Card */}
                        <div
                            onClick={() => {
                                setShowingBranches(!showingBranches);
                            }}
                            className={`group relative bg-mac-surface/40 backdrop-blur rounded-2xl p-6 border border-mac-border shadow-mac hover:shadow-mac-md transition-all cursor-pointer active:scale-[0.98] ${showingBranches ? "z-[60]" : "z-0"}`}
                        >
                            <div className="w-8 h-8 rounded-lg bg-mac-accent/10 flex items-center justify-center mb-4 group-hover:bg-mac-accent/20 transition-colors">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 16 16"
                                    fill="currentColor"
                                    className="w-4 h-4 text-mac-accent"
                                >
                                    <path d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1.25 1.25 0 00-1.03 1.93.75.75 0 01-1.24.84A2.75 2.75 0 016.5 7H10A1 1 0 0011 6V5.372a2.25 2.25 0 01-1.5-2.122zM4.75 11.5a.75.75 0 100 1.5.75.75 0 000-1.5zM3.25 12.25a2.25 2.25 0 113 2.122V16.5a.75.75 0 01-1.5 0v-2.128a2.25 2.25 0 01-1.5-2.122z" />
                                </svg>
                            </div>
                            <div className="text-2xl font-black text-mac-text mb-1 h-8 flex items-center">
                                {statsLoading ? (
                                    <div className="w-4 h-4 border-2 border-mac-text/20 border-t-mac-accent rounded-full animate-spin" />
                                ) : (
                                    (projectStats?.branchCount ?? "-")
                                )}
                            </div>
                            <div className="text-[10px] font-bold text-mac-secondary uppercase tracking-widest opacity-60">
                                Branches
                            </div>

                            {showingBranches && projectStats?.branches && (
                                <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-mac-surface border border-mac-border rounded-xl shadow-mac-lg p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <h4 className="text-[10px] font-bold text-mac-secondary uppercase tracking-widest mb-3 pb-2 border-b border-mac-border/50">
                                        All Branches
                                    </h4>
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                                        {projectStats.branches.map((branch) => (
                                            <div
                                                key={branch}
                                                className="flex items-center gap-2 text-[13px] text-mac-text py-1.5 px-2 rounded-lg hover:bg-mac-accent/10 hover:text-mac-accent transition-colors font-medium"
                                            >
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 16 16"
                                                    fill="currentColor"
                                                    className="w-3.5 h-3.5 opacity-60"
                                                >
                                                    <path d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1.25 1.25 0 00-1.03 1.93.75.75 0 01-1.24.84A2.75 2.75 0 016.5 7H10A1 1 0 0011 6V5.372a2.25 2.25 0 01-1.5-2.122zM4.75 11.5a.75.75 0 100 1.5.75.75 0 000-1.5zM3.25 12.25a2.25 2.25 0 113 2.122V16.5a.75.75 0 01-1.5 0v-2.128a2.25 2.25 0 01-1.5-2.122z" />
                                                </svg>
                                                <span className="truncate">
                                                    {branch}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Commits Card */}
                        <div
                            onClick={onCommitsClick}
                            className="group bg-mac-surface/40 backdrop-blur rounded-2xl p-6 border border-mac-border shadow-mac hover:shadow-mac-md transition-all cursor-pointer active:scale-[0.98]"
                        >
                            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center mb-4 group-hover:bg-green-500/20 transition-colors">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 16 16"
                                    fill="currentColor"
                                    className="w-4 h-4 text-green-500"
                                >
                                    <path d="M10.5 7.75a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm1.43.75a4.002 4.002 0 01-7.86 0H.75a.75.75 0 110-1.5h3.32a4.001 4.001 0 017.86 0h4.32a.75.75 0 110 1.5h-4.32z" />
                                </svg>
                            </div>
                            <div className="text-2xl font-black text-mac-text mb-1 h-8 flex items-center">
                                {statsLoading ? (
                                    <div className="w-4 h-4 border-2 border-mac-text/20 border-t-green-500 rounded-full animate-spin" />
                                ) : (
                                    (projectStats?.totalCommits ?? "-")
                                )}
                            </div>
                            <div className="text-[10px] font-bold text-mac-secondary uppercase tracking-widest opacity-60">
                                Commits
                            </div>
                        </div>

                        {/* Issues Card */}
                        <div
                            onClick={
                                isGitHubAuthenticated
                                    ? onGitHubClick
                                    : onGitHubSignIn
                            }
                            className={`group bg-mac-surface/40 backdrop-blur rounded-2xl p-6 border border-mac-border shadow-mac hover:shadow-mac-md transition-all cursor-pointer active:scale-[0.98]`}
                        >
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                                <IssueIcon className="w-4 h-4 text-emerald-500" />
                            </div>
                            {isGitHubAuthenticated ? (
                                <>
                                    <div className="text-2xl font-black text-mac-text mb-1 h-8 flex items-center">
                                        {githubLoading ? (
                                            <div className="w-4 h-4 border-2 border-mac-text/20 border-t-mac-accent rounded-full animate-spin" />
                                        ) : (
                                            (githubData?.openIssues ?? "-")
                                        )}
                                    </div>
                                    <div className="text-[10px] font-bold text-mac-secondary uppercase tracking-widest opacity-60">
                                        Issues
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="text-2xl mb-1">
                                        <GitHubSignInPrompt
                                            onClick={onGitHubSignIn}
                                            loading={githubLoading}
                                        />
                                    </div>
                                    <div className="text-[10px] font-bold text-mac-secondary uppercase tracking-widest opacity-60">
                                        Issues
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Pull Requests Card */}
                        <div
                            onClick={
                                isGitHubAuthenticated
                                    ? onGitHubClick
                                    : onGitHubSignIn
                            }
                            className={`group bg-mac-surface/40 backdrop-blur rounded-2xl p-6 border border-mac-border shadow-mac hover:shadow-mac-md transition-all cursor-pointer active:scale-[0.98]`}
                        >
                            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4 group-hover:bg-purple-500/20 transition-colors">
                                <PullRequestIcon className="w-4 h-4 text-purple-500" />
                            </div>
                            {isGitHubAuthenticated ? (
                                <>
                                    <div className="text-2xl font-black text-mac-text mb-1 h-8 flex items-center">
                                        {githubLoading ? (
                                            <div className="w-4 h-4 border-2 border-mac-text/20 border-t-mac-accent rounded-full animate-spin" />
                                        ) : (
                                            (githubData?.openPRs ?? "-")
                                        )}
                                    </div>
                                    <div className="text-[10px] font-bold text-mac-secondary uppercase tracking-widest opacity-60">
                                        Pull Requests
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="text-2xl mb-1">
                                        <GitHubSignInPrompt
                                            onClick={onGitHubSignIn}
                                            loading={githubLoading}
                                        />
                                    </div>
                                    <div className="text-[10px] font-bold text-mac-secondary uppercase tracking-widest opacity-60">
                                        Pull Requests
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Chart Card */}
                    <div className="lg:col-span-4 bg-mac-surface/40 backdrop-blur rounded-2xl p-6 border border-mac-border shadow-mac">
                        <div className="flex items-center justify-between mb-6">
                            <span className="text-[10px] font-bold text-mac-secondary uppercase tracking-widest opacity-60">
                                7-Day Pulse
                            </span>
                            <span className="text-[10px] font-bold text-mac-accent uppercase">
                                {eventCount} events today
                            </span>
                        </div>
                        <div className="flex items-end justify-between h-20 gap-1.5 px-1">
                            {dailyCounts.map((d, i) => (
                                <div
                                    key={i}
                                    className="flex-1 flex flex-col items-center gap-2 group"
                                >
                                    <div
                                        className={`w-full rounded-t-sm transition-all duration-500 ${i === dailyCounts.length - 1 ? "bg-mac-accent shadow-[0_0_12px_rgba(0,122,255,0.4)]" : "bg-mac-accent/30 group-hover:bg-mac-accent/50"}`}
                                        style={{
                                            height: `${(d.count / maxCount) * 100}%`,
                                            minHeight: "4px",
                                        }}
                                    />
                                    <span className="text-[8px] font-bold text-mac-secondary uppercase tracking-tighter opacity-40">
                                        {d.day}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full px-24 py-12 select-none">
            {/* Project Context Header */}
            <div className="mb-12">
                <h2 className="text-sm font-bold text-mac-secondary uppercase tracking-[0.2em] mb-4">
                    Project Overview
                </h2>
                <div className="flex items-center gap-6">
                    <div className="flex-1">
                        <h3 className="text-3xl font-extrabold text-mac-text tracking-tight mb-2">
                            {project.name}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-mac-secondary font-mono">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                className="w-4 h-4"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                                />
                            </svg>
                            {project.path}
                        </div>
                    </div>
                    {gitSnapshot && (
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-mac-surface border border-mac-border/50 shadow-mac-sm">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                    className="w-4 h-4 text-mac-accent"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M4 6h16M4 12h16M4 18h7"
                                    />
                                </svg>
                                <span className="text-sm font-bold text-mac-text">
                                    {gitSnapshot.branch}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
                {/* Branches Card */}
                <div
                    onClick={() => {
                        setShowingBranches(!showingBranches);
                    }}
                    className={`group relative bg-mac-surface/40 backdrop-blur rounded-3xl p-8 border border-mac-border shadow-mac hover:shadow-mac-md transition-all cursor-pointer active:scale-[0.98] ${showingBranches ? "z-[60]" : "z-0"}`}
                >
                    <div className="w-10 h-10 rounded-xl bg-mac-accent/10 flex items-center justify-center mb-6 group-hover:bg-mac-accent/20 transition-colors">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                            className="w-5 h-5 text-mac-accent"
                        >
                            <path d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1.25 1.25 0 00-1.03 1.93.75.75 0 01-1.24.84A2.75 2.75 0 016.5 7H10A1 1 0 0011 6V5.372a2.25 2.25 0 01-1.5-2.122zM4.75 11.5a.75.75 0 100 1.5.75.75 0 000-1.5zM3.25 12.25a2.25 2.25 0 113 2.122V16.5a.75.75 0 01-1.5 0v-2.128a2.25 2.25 0 01-1.5-2.122z" />
                        </svg>
                    </div>
                    <div className="text-3xl font-black text-mac-text mb-1">
                        {projectStats?.branchCount ?? "-"}
                    </div>
                    <div className="text-xs font-bold text-mac-secondary uppercase tracking-widest">
                        Active Branches
                    </div>

                    {showingBranches && projectStats?.branches && (
                        <div className="absolute top-full left-0 right-0 mt-4 z-50 bg-mac-surface border border-mac-border rounded-2xl shadow-mac-lg p-6 animate-in fade-in slide-in-from-top-2 duration-200">
                            <h4 className="text-xs font-bold text-mac-secondary uppercase tracking-widest mb-4 pb-3 border-b border-mac-border/50">
                                All Project Branches
                            </h4>
                            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                                {projectStats.branches.map((branch) => (
                                    <div
                                        key={branch}
                                        className="flex items-center gap-3 text-[15px] text-mac-text py-3 px-4 rounded-xl hover:bg-mac-accent/10 hover:text-mac-accent transition-all border border-transparent hover:border-mac-accent/20 font-medium"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 16 16"
                                            fill="currentColor"
                                            className="w-4 h-4 opacity-60"
                                        >
                                            <path d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1.25 1.25 0 00-1.03 1.93.75.75 0 01-1.24.84A2.75 2.75 0 016.5 7H10A1 1 0 0011 6V5.372a2.25 2.25 0 01-1.5-2.122zM4.75 11.5a.75.75 0 100 1.5.75.75 0 000-1.5zM3.25 12.25a2.25 2.25 0 113 2.122V16.5a.75.75 0 01-1.5 0v-2.128a2.25 2.25 0 01-1.5-2.122z" />
                                        </svg>
                                        <span className="truncate">
                                            {branch}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Commits Card */}
                <div
                    onClick={onCommitsClick}
                    className="group bg-mac-surface/40 backdrop-blur rounded-3xl p-8 border border-mac-border shadow-mac hover:shadow-mac-md transition-all cursor-pointer active:scale-[0.98]"
                >
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center mb-6 group-hover:bg-green-500/20 transition-colors">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                            className="w-5 h-5 text-green-500"
                        >
                            <path d="M10.5 7.75a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm1.43.75a4.002 4.002 0 01-7.86 0H.75a.75.75 0 110-1.5h3.32a4.001 4.001 0 017.86 0h4.32a.75.75 0 110 1.5h-4.32z" />
                        </svg>
                    </div>
                    <div className="text-3xl font-black text-mac-text mb-1">
                        {projectStats?.totalCommits ?? "-"}
                    </div>
                    <div className="text-xs font-bold text-mac-secondary uppercase tracking-widest">
                        Total Commits
                    </div>
                </div>

                {/* Issues Card */}
                <div
                    onClick={
                        !isGitHubAuthenticated ? onGitHubSignIn : undefined
                    }
                    className={`group bg-mac-surface/40 backdrop-blur rounded-3xl p-8 border border-mac-border shadow-mac hover:shadow-mac-md transition-all ${!isGitHubAuthenticated ? "cursor-pointer active:scale-[0.98]" : ""}`}
                >
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-6 group-hover:bg-emerald-500/20 transition-colors">
                        <IssueIcon className="w-5 h-5 text-emerald-500" />
                    </div>
                    {isGitHubAuthenticated ? (
                        <>
                            <div className="text-3xl font-black text-mac-text mb-1">
                                {githubLoading
                                    ? "…"
                                    : (githubData?.openIssues ?? "-")}
                            </div>
                            <div className="text-xs font-bold text-mac-secondary uppercase tracking-widest">
                                Open Issues
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="text-3xl mb-1">
                                <GitHubSignInPrompt
                                    onClick={onGitHubSignIn}
                                    loading={githubLoading}
                                />
                            </div>
                            <div className="text-xs font-bold text-mac-secondary uppercase tracking-widest">
                                Issues
                            </div>
                        </>
                    )}
                </div>

                {/* Pull Requests Card */}
                <div
                    onClick={
                        !isGitHubAuthenticated ? onGitHubSignIn : undefined
                    }
                    className={`group bg-mac-surface/40 backdrop-blur rounded-3xl p-8 border border-mac-border shadow-mac hover:shadow-mac-md transition-all ${!isGitHubAuthenticated ? "cursor-pointer active:scale-[0.98]" : ""}`}
                >
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-6 group-hover:bg-purple-500/20 transition-colors">
                        <PullRequestIcon className="w-5 h-5 text-purple-500" />
                    </div>
                    {isGitHubAuthenticated ? (
                        <>
                            <div className="text-3xl font-black text-mac-text mb-1">
                                {githubLoading
                                    ? "…"
                                    : (githubData?.openPRs ?? "-")}
                            </div>
                            <div className="text-xs font-bold text-mac-secondary uppercase tracking-widest">
                                Pull Requests
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="text-3xl mb-1">
                                <GitHubSignInPrompt
                                    onClick={onGitHubSignIn}
                                    loading={githubLoading}
                                />
                            </div>
                            <div className="text-xs font-bold text-mac-secondary uppercase tracking-widest">
                                Pull Requests
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Chart Section */}
            <div className="bg-mac-surface/40 backdrop-blur rounded-3xl p-8 border border-mac-border shadow-mac mb-12">
                <h4 className="text-sm font-bold text-mac-text uppercase tracking-widest mb-8">
                    7-Day Heartbeat
                </h4>
                <div className="flex items-end justify-between h-48 gap-4 px-2">
                    {Array.from({ length: 7 }, (_, i) => {
                        const date = new Date();
                        date.setDate(date.getDate() - i);
                        const dateStr = date.toDateString();
                        const dayEvents = events.filter(
                            (e) =>
                                new Date(e.timestamp).toDateString() ===
                                dateStr,
                        );
                        const count = dayEvents.length;
                        return { day: dateStr.split(" ")[0], count };
                    })
                        .reverse()
                        .map((d, i, arr) => {
                            const max = Math.max(...arr.map((x) => x.count), 1);
                            return (
                                <div
                                    key={i}
                                    className="flex-1 flex flex-col items-center gap-4 group"
                                >
                                    <div className="relative w-full flex flex-col items-center justify-end h-full">
                                        <div
                                            className={`w-full max-w-[40px] rounded-t-lg transition-all duration-500 ${i === arr.length - 1 ? "bg-mac-accent shadow-[0_0_20px_rgba(0,122,255,0.4)]" : "bg-mac-accent/20 group-hover:bg-mac-accent/40"}`}
                                            style={{
                                                height: `${(d.count / max) * 100}%`,
                                                minHeight: "8px",
                                            }}
                                        />
                                        <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-mac-surface border border-mac-border px-2 py-1 rounded text-[10px] font-bold shadow-mac-sm">
                                            {d.count} events
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold text-mac-secondary uppercase tracking-widest">
                                        {d.day}
                                    </span>
                                </div>
                            );
                        })}
                </div>
            </div>

            {/* Bottom Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-mac-surface/40 backdrop-blur rounded-3xl p-8 border border-mac-border shadow-mac">
                    <div className="flex items-center justify-between mb-6">
                        <h4 className="text-sm font-bold text-mac-text uppercase tracking-widest">
                            Recent Activity
                        </h4>
                        <span className="text-lg font-bold text-mac-accent">
                            {eventCount}
                        </span>
                    </div>
                    <div className="w-full h-4 bg-mac-bg/50 rounded-full overflow-hidden mb-4 border border-mac-border/20">
                        <div
                            className="h-full bg-mac-accent transition-all duration-1000 shadow-[0_0_12px_rgba(0,122,255,0.4)]"
                            style={{
                                width: `${Math.min(100, (eventCount / 50) * 100)}%`,
                            }}
                        />
                    </div>
                    <p className="text-xs text-mac-secondary leading-relaxed">
                        {eventCount === 0
                            ? "No file events tracked in the last 24 hours."
                            : `Tracking ${eventCount} significant file events today. Keep it up!`}
                    </p>
                </div>

                <div className="flex flex-col justify-center px-8">
                    <div className="mb-4">
                        <span className="text-[10px] font-bold text-mac-secondary uppercase tracking-[0.3em]">
                            Last Heartbeat
                        </span>
                        <div className="text-2xl font-bold text-mac-text mt-1">
                            {timeAgo(project.lastActivityAt, {
                                emptyLabel: "never",
                                justNowLabel: "just now",
                                maxDays: Number.POSITIVE_INFINITY,
                            })}
                        </div>
                    </div>
                    <div className="h-px w-24 bg-mac-border/50 mb-4" />
                    <p className="text-xs text-mac-secondary leading-relaxed max-w-xs">
                        This project was last modified on{" "}
                        <span className="text-mac-text font-medium">
                            {project.lastActivityAt
                                ? new Date(
                                      project.lastActivityAt,
                                  ).toLocaleDateString()
                                : "an unknown date"}
                        </span>
                        .
                    </p>
                </div>
            </div>
        </div>
    );
}
