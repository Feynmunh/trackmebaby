import { useEffect, useMemo, useState } from "react";
import { timeAgo } from "../../../shared/time.ts";
import type {
    ActivityEvent,
    ActivitySummary,
    GitHubData,
    GitSnapshot,
    Project,
    ProjectStats,
} from "../../../shared/types.ts";
import {
    IssueIcon,
    PullRequestIcon,
} from "../../components/icons/GitHubIcons.tsx";
import StatCard from "../../components/ui/StatCard.tsx";
import { getVitalityStatus } from "../../components/utils/vitality.ts";
import ActivityChart, { type ActivityChartItem } from "./ActivityChart.tsx";

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
}: OverviewPageProps) {
    const [showingBranches, setShowingBranches] = useState(false);
    const [, forceRender] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            forceRender((n) => n + 1);
        }, 60000);
        return () => clearInterval(timer);
    }, []);

    const branchList = projectStats?.branches ?? [];
    const vitality = getVitalityStatus(project, eventCount, gitSnapshot);

    const heartbeatCounts: ActivityChartItem[] = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const cutoff = new Date(today);
        cutoff.setDate(cutoff.getDate() - 6);

        const dateCounts = new Map<string, number>();
        for (const event of events) {
            const d = new Date(event.timestamp);
            d.setHours(0, 0, 0, 0);
            if (d < cutoff || d > today) continue;
            const key = d.toDateString();
            dateCounts.set(key, (dateCounts.get(key) ?? 0) + 1);
        }

        return Array.from({ length: 7 }, (_, i) => {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateStr = date.toDateString();
            return {
                day: dateStr.split(" ")[0],
                count: dateCounts.get(dateStr) ?? 0,
            };
        }).reverse();
    }, [events]);

    const heartbeatMax = Math.max(
        ...heartbeatCounts.map((entry) => entry.count),
        1,
    );

    const vitalityBars = useMemo(() => {
        const bv = projectStats?.branchCount ?? 0;
        const cv = projectStats?.totalCommits ?? 0;
        const iv = githubData?.openIssues ?? 0;
        const pv = githubData?.openPRs ?? 0;

        return [
            {
                key: "branches",
                label: "Branches",
                value: bv,
                displayVal: statsLoading ? null : String(bv || "-"),
                loading: statsLoading,
                onClick: () => setShowingBranches(!showingBranches),
                stripe: "rgba(229,81,14,0.9)",
                needsAuth: false,
            },
            {
                key: "commits",
                label: "Commits",
                value: cv,
                displayVal: statsLoading ? null : String(cv || "-"),
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
                      : String(iv || "-"),
                loading: githubLoading,
                onClick: isGitHubAuthenticated ? onGitHubClick : onGitHubSignIn,
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
                      : String(pv || "-"),
                loading: githubLoading,
                onClick: isGitHubAuthenticated ? onGitHubClick : onGitHubSignIn,
                stripe: "rgba(120,120,120,0.4)",
                needsAuth: !isGitHubAuthenticated,
            },
        ];
    }, [
        githubData?.openIssues,
        githubData?.openPRs,
        githubLoading,
        isGitHubAuthenticated,
        onCommitsClick,
        onGitHubClick,
        onGitHubSignIn,
        projectStats?.branchCount,
        projectStats?.totalCommits,
        showingBranches,
        statsLoading,
    ]);

    const barMax = Math.max(...vitalityBars.map((r) => r.value), 1);

    if (isWidget) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                    <h2 className="text-[10px] font-semibold text-app-text-muted uppercase tracking-[0.2em] shrink-0">
                        Project Vitality
                    </h2>
                    <span
                        className={`text-[10px] font-semibold ${vitality.colorClass} ${vitality.bgClass} px-2 py-0.5 rounded uppercase tracking-widest`}
                    >
                        {vitality.label}
                    </span>
                </div>

                <div className="relative overflow-visible">
                    <div className="space-y-1">
                        {vitalityBars.map((row) => {
                            const pct =
                                barMax > 0 ? (row.value / barMax) * 100 : 0;
                            const isTop = row.value === barMax && row.value > 0;
                            return (
                                <div
                                    key={row.key}
                                    className="group flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-app-hover transition-colors -mx-2 cursor-pointer"
                                    onClick={row.onClick}
                                >
                                    <div className="flex items-center gap-1.5 w-[72px] justify-end shrink-0">
                                        <span
                                            className="w-1.5 h-1.5 rounded-full shrink-0 opacity-80"
                                            style={{ background: row.stripe }}
                                        />
                                        <span className="text-right text-[10px] font-semibold uppercase tracking-widest text-app-text-muted group-hover:text-app-text-main transition-colors leading-none">
                                            {row.label}
                                        </span>
                                    </div>
                                    <div className="flex-1 h-[8px] rounded-full overflow-hidden bg-app-bg">
                                        {row.loading ? (
                                            <div className="h-full w-1/3 bg-app-border/40 rounded-full animate-pulse" />
                                        ) : row.needsAuth ? (
                                            <div className="h-full flex items-center px-2">
                                                <span className="text-[9px] text-app-text-muted/40 italic">
                                                    sign in
                                                </span>
                                            </div>
                                        ) : (
                                            <div
                                                className="h-full rounded-full transition-all duration-700"
                                                style={{
                                                    width: `${Math.max(pct, row.value > 0 ? 3 : 0)}%`,
                                                    background: `linear-gradient(90deg, ${row.stripe} 0%, ${row.stripe}99 100%)`,
                                                    boxShadow: isTop
                                                        ? `0 0 8px ${row.stripe}70`
                                                        : undefined,
                                                }}
                                            />
                                        )}
                                    </div>
                                    <span className="text-[11px] font-bold text-app-text-main w-7 text-right shrink-0 tabular-nums">
                                        {row.loading ? (
                                            <span className="text-app-text-muted/50 animate-pulse">
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

                    {showingBranches && branchList.length > 0 && (
                        <div
                            className="absolute left-0 right-0 z-50 bg-app-surface border border-app-border rounded-xl p-4 shadow-app-sm"
                            style={{ top: "calc(100% + 8px)" }}
                        >
                            <h4 className="text-[10px] text-app-text-muted uppercase tracking-widest mb-3 pb-2 border-b border-app-border">
                                All Branches
                            </h4>
                            <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                                {branchList.map((branch: string) => (
                                    <div
                                        key={branch}
                                        className="flex items-center gap-2 text-[12px] text-app-text-main py-1 px-2 rounded hover:bg-app-hover"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 16 16"
                                            fill="currentColor"
                                            className="w-3 h-3 text-app-text-muted shrink-0"
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
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full px-24 py-12 select-none">
            <div className="mb-12">
                <h2 className="text-sm font-bold text-app-text-muted uppercase tracking-[0.2em] mb-4">
                    Project Overview
                </h2>
                <div className="flex items-center gap-6">
                    <div className="flex-1">
                        <h3 className="text-3xl font-extrabold text-app-text-main tracking-tight mb-2">
                            {project.name}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-app-text-muted font-mono">
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
                            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-app-surface border border-app-border/50 shadow-app-sm">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                    className="w-4 h-4 text-app-accent"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M4 6h16M4 12h16M4 18h7"
                                    />
                                </svg>
                                <span className="text-sm font-bold text-app-text-main">
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
                    className={`group relative bg-app-surface/40 backdrop-blur rounded-3xl p-8 border border-app-border shadow-app-sm hover:shadow-app-md transition-all cursor-pointer active:scale-[0.98] ${showingBranches ? "z-[60]" : "z-0"}`}
                >
                    <div className="w-10 h-10 rounded-xl bg-app-accent/10 flex items-center justify-center mb-6 group-hover:bg-app-accent/20 transition-colors">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                            className="w-5 h-5 text-app-accent"
                        >
                            <path d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1.25 1.25 0 00-1.03 1.93.75.75 0 01-1.24.84A2.75 2.75 0 016.5 7H10A1 1 0 0011 6V5.372a2.25 2.25 0 01-1.5-2.122zM4.75 11.5a.75.75 0 100 1.5.75.75 0 000-1.5zM3.25 12.25a2.25 2.25 0 113 2.122V16.5a.75.75 0 01-1.5 0v-2.128a2.25 2.25 0 01-1.5-2.122z" />
                        </svg>
                    </div>
                    <div className="text-3xl font-black text-app-text-main mb-1">
                        {projectStats?.branchCount ?? "-"}
                    </div>
                    <div className="text-xs font-bold text-app-text-muted uppercase tracking-widest">
                        Active Branches
                    </div>
                    {showingBranches && branchList.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-4 z-50 bg-app-surface border border-app-border rounded-2xl shadow-app-lg p-6 animate-in fade-in slide-in-from-top-2 duration-200">
                            <h4 className="text-xs font-bold text-app-text-muted uppercase tracking-widest mb-4 pb-3 border-b border-app-border/50">
                                All Project Branches
                            </h4>
                            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                                {branchList.map((branch: string) => (
                                    <div
                                        key={branch}
                                        className="flex items-center gap-3 text-[15px] text-app-text-main py-3 px-4 rounded-xl hover:bg-app-accent/10 hover:text-app-accent transition-all border border-transparent hover:border-app-accent/20 font-medium"
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
                    className="group bg-app-surface/40 backdrop-blur rounded-3xl p-8 border border-app-border shadow-app-sm hover:shadow-app-md transition-all cursor-pointer active:scale-[0.98]"
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
                    <div className="text-3xl font-black text-app-text-main mb-1">
                        {projectStats?.totalCommits ?? "-"}
                    </div>
                    <div className="text-xs font-bold text-app-text-muted uppercase tracking-widest">
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
                    className={`bg-app-surface/40 backdrop-blur rounded-3xl p-8 border border-app-border shadow-app-sm hover:shadow-app-md transition-all ${!isGitHubAuthenticated ? "cursor-pointer active:scale-[0.98]" : ""}`}
                    iconWrapperClassName="mb-6"
                    valueClassName="text-3xl font-black text-app-text-main mb-1"
                    titleClassName="text-xs font-bold text-app-text-muted uppercase tracking-widest"
                    authValueClassName="text-3xl mb-1"
                    authLabelClassName="text-xs font-bold text-app-text-muted uppercase tracking-widest"
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
                    className={`bg-app-surface/40 backdrop-blur rounded-3xl p-8 border border-app-border shadow-app-sm hover:shadow-app-md transition-all ${!isGitHubAuthenticated ? "cursor-pointer active:scale-[0.98]" : ""}`}
                    iconWrapperClassName="mb-6"
                    valueClassName="text-3xl font-black text-app-text-main mb-1"
                    titleClassName="text-xs font-bold text-app-text-muted uppercase tracking-widest"
                    authValueClassName="text-3xl mb-1"
                    authLabelClassName="text-xs font-bold text-app-text-muted uppercase tracking-widest"
                />
            </div>

            <ActivityChart
                dailyCounts={heartbeatCounts}
                eventCount={eventCount}
                maxCount={heartbeatMax}
                variant="heartbeat"
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-app-surface/40 backdrop-blur rounded-3xl p-8 border border-app-border shadow-app-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h4 className="text-sm font-bold text-app-text-main uppercase tracking-widest">
                            Recent Activity
                        </h4>
                        <span className="text-lg font-bold text-app-accent">
                            {eventCount}
                        </span>
                    </div>
                    <div className="w-full h-4 bg-app-bg/50 rounded-full overflow-hidden mb-4 border border-app-border/20">
                        <div
                            className="h-full bg-app-accent transition-all duration-1000 shadow-[0_0_12px_rgba(0,122,255,0.4)]"
                            style={{
                                width: `${Math.min(100, (eventCount / 50) * 100)}%`,
                            }}
                        />
                    </div>
                    <p className="text-xs text-app-text-muted leading-relaxed">
                        {eventCount === 0
                            ? "No file events tracked in the last 24 hours."
                            : `Tracking ${eventCount} significant file events today. Keep it up!`}
                    </p>
                </div>

                <div className="flex flex-col justify-center px-8">
                    <div className="mb-4">
                        <span className="text-[10px] font-bold text-app-text-muted uppercase tracking-[0.3em]">
                            Last Heartbeat
                        </span>
                        <div className="text-2xl font-bold text-app-text-main mt-1">
                            {timeAgo(project.lastActivityAt, {
                                emptyLabel: "never",
                                justNowLabel: "just now",
                                maxDays: Number.POSITIVE_INFINITY,
                            })}
                        </div>
                    </div>
                    <div className="h-px w-24 bg-app-border/50 mb-4" />
                    <p className="text-xs text-app-text-muted leading-relaxed max-w-xs">
                        This project was last modified on{" "}
                        <span className="text-app-text-main font-medium">
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
