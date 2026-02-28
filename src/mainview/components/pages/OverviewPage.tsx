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
import ActivityChart, {
    type ActivityChartItem,
} from "../charts/ActivityChart.tsx";
import { IssueIcon, PullRequestIcon } from "../icons/GitHubIcons.tsx";
import StatCard from "../ui/StatCard.tsx";
import { getVitalityStatus } from "../utils/vitality.ts";

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

export default function OverviewPage({
    project,
    gitSnapshot,
    projectStats,
    eventCount,
    events,
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

    if (isWidget) {
        const vitality = getVitalityStatus(project, eventCount, gitSnapshot);

        return (
            <div className="space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                    <h2 className="text-[10px] font-semibold text-mac-secondary uppercase tracking-[0.2em] shrink-0">
                        Project Vitality
                    </h2>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        {statsLastUpdated && (
                            <span className="text-[10px] text-mac-secondary uppercase tracking-widest">
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
                                className="px-2 py-0.5 rounded border border-mac-border bg-transparent text-[9px] font-bold uppercase tracking-widest text-mac-secondary hover:text-orange-400 hover:border-orange-500/30 transition-colors"
                            >
                                Refresh
                            </button>
                        )}
                        <span
                            className={`text-[10px] font-semibold ${vitality.colorClass} ${vitality.bgClass} px-2 py-0.5 rounded uppercase tracking-widest`}
                        >
                            {vitality.label}
                        </span>
                    </div>
                </div>

                {/* Horizontal Stats Bar Chart */}
                {(() => {
                    const bv =
                        typeof projectStats?.branchCount === "number"
                            ? projectStats.branchCount
                            : 0;
                    const cv =
                        typeof projectStats?.totalCommits === "number"
                            ? projectStats.totalCommits
                            : 0;
                    const iv =
                        isGitHubAuthenticated &&
                        typeof githubData?.openIssues === "number"
                            ? githubData.openIssues
                            : 0;
                    const pv =
                        isGitHubAuthenticated &&
                        typeof githubData?.openPRs === "number"
                            ? githubData.openPRs
                            : 0;
                    const rawMax = Math.max(bv, cv, iv, pv, 1);
                    const step =
                        rawMax <= 5
                            ? 1
                            : rawMax <= 20
                              ? 5
                              : rawMax <= 50
                                ? 10
                                : rawMax <= 200
                                  ? 50
                                  : 100;
                    const niceMax = Math.ceil(rawMax / step) * step;
                    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) =>
                        Math.round(f * niceMax),
                    );
                    const barRows = [
                        {
                            key: "branches",
                            label: "Branches",
                            value: bv,
                            displayVal: statsLoading
                                ? null
                                : String(projectStats?.branchCount ?? "-"),
                            loading: statsLoading,
                            onClick: () =>
                                setShowingBranches(!showingBranches),
                            stripe: "rgba(229,81,14,0.9)",
                            needsAuth: false,
                        },
                        {
                            key: "commits",
                            label: "Commits",
                            value: cv,
                            displayVal: statsLoading
                                ? null
                                : String(projectStats?.totalCommits ?? "-"),
                            loading: statsLoading,
                            onClick: onCommitsClick,
                            stripe: "rgba(229,81,14,0.55)",
                            needsAuth: false,
                        },
                        {
                            key: "issues",
                            label: "Issues",
                            value: iv,
                            displayVal: githubLoading
                                ? null
                                : !isGitHubAuthenticated
                                  ? "—"
                                  : String(githubData?.openIssues ?? "-"),
                            loading: githubLoading,
                            onClick: isGitHubAuthenticated
                                ? onGitHubClick
                                : onGitHubSignIn,
                            stripe: "rgba(160,160,160,0.6)",
                            needsAuth: !isGitHubAuthenticated,
                        },
                        {
                            key: "prs",
                            label: "Pull Req.",
                            value: pv,
                            displayVal: githubLoading
                                ? null
                                : !isGitHubAuthenticated
                                  ? "—"
                                  : String(githubData?.openPRs ?? "-"),
                            loading: githubLoading,
                            onClick: isGitHubAuthenticated
                                ? onGitHubClick
                                : onGitHubSignIn,
                            stripe: "rgba(120,120,120,0.4)",
                            needsAuth: !isGitHubAuthenticated,
                        },
                    ];

                    return (
                        <div className="bg-transparent rounded-xl border border-mac-border p-4 relative overflow-visible">
                            {/* Bar rows */}
                            <div className="space-y-3">
                                {barRows.map((row) => {
                                    const pct =
                                        niceMax > 0
                                            ? (row.value / niceMax) * 100
                                            : 0;
                                    return (
                                        <div
                                            key={row.key}
                                            className="flex items-center gap-3"
                                        >
                                            {/* Clickable label */}
                                            <button
                                                onClick={row.onClick}
                                                className="w-[68px] text-right text-[10px] font-semibold uppercase tracking-widest text-mac-secondary hover:text-orange-400 active:text-orange-500 transition-colors shrink-0 leading-none"
                                            >
                                                {row.label}
                                            </button>
                                            {/* Bar track */}
                                            <div className="flex-1 h-[13px] rounded-sm overflow-hidden bg-mac-hover">
                                                {row.loading ? (
                                                    <div className="h-full w-1/3 bg-mac-border/40 rounded animate-pulse" />
                                                ) : row.needsAuth ? (
                                                    <div className="h-full flex items-center px-2">
                                                        <span className="text-[9px] text-mac-secondary/40 italic">
                                                            sign in
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div
                                                        className="h-full rounded-sm"
                                                        style={{
                                                            width: `${Math.max(pct, row.value > 0 ? 2 : 0)}%`,
                                                            background: `repeating-linear-gradient(90deg, ${row.stripe} 0px, ${row.stripe} 4px, transparent 4px, transparent 7px)`,
                                                            transition:
                                                                "width 0.6s ease",
                                                        }}
                                                    />
                                                )}
                                            </div>
                                            {/* Numeric value */}
                                            <span className="text-[11px] font-bold text-mac-text w-6 text-right shrink-0 tabular-nums">
                                                {row.loading ? (
                                                    <span className="text-mac-secondary/50 animate-pulse">
                                                        ·
                                                    </span>
                                                ) : (
                                                    row.displayVal
                                                )}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            {/* X-axis tick labels */}
                            <div
                                className="flex justify-between mt-3 pt-2 border-t border-mac-border/20"
                                style={{
                                    paddingLeft: "80px",
                                    paddingRight: "36px",
                                }}
                            >
                                {ticks.map((t) => (
                                    <span
                                        key={t}
                                        className="text-[9px] text-mac-secondary/40 tabular-nums"
                                    >
                                        {t}
                                    </span>
                                ))}
                            </div>
                            {/* Branches dropdown */}
                            {showingBranches && projectStats?.branches && (
                                <div
                                    className="absolute left-0 right-0 z-50 bg-mac-surface border border-mac-border rounded-xl p-4 shadow-mac"
                                    style={{ top: "calc(100% + 8px)" }}
                                >
                                    <h4 className="text-[10px] text-mac-secondary uppercase tracking-widest mb-3 pb-2 border-b border-mac-border">
                                        All Branches
                                    </h4>
                                    <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                                        {projectStats.branches.map(
                                            (branch) => (
                                                <div
                                                    key={branch}
                                                    className="flex items-center gap-2 text-[12px] text-mac-text py-1 px-2 rounded hover:bg-mac-hover"
                                                >
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        viewBox="0 0 16 16"
                                                        fill="currentColor"
                                                        className="w-3 h-3 text-mac-secondary shrink-0"
                                                    >
                                                        <path d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1.25 1.25 0 00-1.03 1.93.75.75 0 01-1.24.84A2.75 2.75 0 016.5 7H10A1 1 0 0011 6V5.372a2.25 2.25 0 01-1.5-2.122zM4.75 11.5a.75.75 0 100 1.5.75.75 0 000-1.5zM3.25 12.25a2.25 2.25 0 113 2.122V16.5a.75.75 0 01-1.5 0v-2.128a2.25 2.25 0 01-1.5-2.122z" />
                                                    </svg>
                                                    <span className="truncate">
                                                        {branch}
                                                    </span>
                                                </div>
                                            ),
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}

            </div>
        );
    }

    const heartbeatCounts: ActivityChartItem[] = Array.from(
        { length: 7 },
        (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toDateString();
            const dayEvents = events.filter(
                (e) => new Date(e.timestamp).toDateString() === dateStr,
            );
            const count = dayEvents.length;
            return { day: dateStr.split(" ")[0], count };
        },
    ).reverse();
    const heartbeatMax = Math.max(
        ...heartbeatCounts.map((entry) => entry.count),
        1,
    );

    return (
        <div className="flex flex-col h-full px-24 py-12 select-none">
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

                <StatCard
                    title="Open Issues"
                    value={githubData?.openIssues ?? "-"}
                    icon={
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                            <IssueIcon className="w-5 h-5 text-emerald-500" />
                        </div>
                    }
                    onClick={
                        !isGitHubAuthenticated ? onGitHubSignIn : undefined
                    }
                    loading={githubLoading}
                    loadingIndicator="…"
                    showAuthPrompt={!isGitHubAuthenticated}
                    authPromptLabel="Issues"
                    onAuthClick={onGitHubSignIn}
                    authLoading={githubLoading}
                    className={`bg-mac-surface/40 backdrop-blur rounded-3xl p-8 border border-mac-border shadow-mac hover:shadow-mac-md transition-all ${!isGitHubAuthenticated ? "cursor-pointer active:scale-[0.98]" : ""}`}
                    iconWrapperClassName="mb-6"
                    valueClassName="text-3xl font-black text-mac-text mb-1"
                    titleClassName="text-xs font-bold text-mac-secondary uppercase tracking-widest"
                    authValueClassName="text-3xl mb-1"
                    authLabelClassName="text-xs font-bold text-mac-secondary uppercase tracking-widest"
                />

                <StatCard
                    title="Pull Requests"
                    value={githubData?.openPRs ?? "-"}
                    icon={
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                            <PullRequestIcon className="w-5 h-5 text-purple-500" />
                        </div>
                    }
                    onClick={
                        !isGitHubAuthenticated ? onGitHubSignIn : undefined
                    }
                    loading={githubLoading}
                    loadingIndicator="…"
                    showAuthPrompt={!isGitHubAuthenticated}
                    authPromptLabel="Pull Requests"
                    onAuthClick={onGitHubSignIn}
                    authLoading={githubLoading}
                    className={`bg-mac-surface/40 backdrop-blur rounded-3xl p-8 border border-mac-border shadow-mac hover:shadow-mac-md transition-all ${!isGitHubAuthenticated ? "cursor-pointer active:scale-[0.98]" : ""}`}
                    iconWrapperClassName="mb-6"
                    valueClassName="text-3xl font-black text-mac-text mb-1"
                    titleClassName="text-xs font-bold text-mac-secondary uppercase tracking-widest"
                    authValueClassName="text-3xl mb-1"
                    authLabelClassName="text-xs font-bold text-mac-secondary uppercase tracking-widest"
                />
            </div>

            <ActivityChart
                dailyCounts={heartbeatCounts}
                eventCount={eventCount}
                maxCount={heartbeatMax}
                variant="heartbeat"
            />

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
