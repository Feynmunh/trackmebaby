import { useState } from "react";
import { timeAgo } from "../../../shared/time.ts";
import type { GitHubData } from "../../../shared/types.ts";
import GitHubItemCard from "../../components/ui/GitHubItemCard.tsx";
import { openExternalUrl } from "../../rpc";
import { CommitTrendGraph } from "../git/CommitTrendGraph.tsx";
import { buildTrend } from "./github-trends.ts";

interface GitHubPageProps {
    githubData?: GitHubData | null;
    githubLoading?: boolean;
    isGitHubAuthenticated?: boolean;
    isWidget?: boolean;
    section?: "environment" | "all" | "issues" | "prs";
    onSignIn?: () => void;
}

const formatGitHubTime = (dateStr: string | null): string =>
    timeAgo(dateStr, { emptyLabel: "", justNowLabel: "just now", maxDays: 7 });

export default function GitHubPage({
    githubData,
    githubLoading,
    isGitHubAuthenticated = false,
    isWidget = false,
    section = "all",
    onSignIn,
}: GitHubPageProps) {
    const [showAllIssues, setShowAllIssues] = useState(false);
    const [showAllPRs, setShowAllPRs] = useState(false);
    const [showIssuesList, setShowIssuesList] = useState(false);
    const [showPRsList, setShowPRsList] = useState(false);

    if (
        isWidget &&
        (section === "environment" || section === "issues" || section === "prs")
    ) {
        if (!isGitHubAuthenticated) {
            return (
                <div className="flex flex-col items-center justify-center h-full py-4 text-center select-none">
                    <div className="w-10 h-10 rounded-xl bg-app-surface flex items-center justify-center mb-3 border border-app-border/50">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                            className="w-5 h-5 text-app-text-muted opacity-40"
                        >
                            <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
                        </svg>
                    </div>
                    <span className="text-[10px] font-bold text-app-text-muted uppercase tracking-widest mb-1 opacity-60">
                        {section === "issues"
                            ? "Issues"
                            : section === "prs"
                              ? "Pull Requests"
                              : "Environment"}
                    </span>
                    <button
                        onClick={onSignIn}
                        className="text-[10px] font-black text-app-accent hover:underline uppercase tracking-widest"
                    >
                        Sign in to view
                    </button>
                </div>
            );
        }

        if (githubLoading || !githubData) {
            return (
                <div className="flex flex-col items-center justify-center h-full py-4 text-center select-none">
                    <div className="w-6 h-6 border-2 border-app-accent border-t-transparent rounded-full animate-spin mb-3" />
                    <span className="text-[10px] font-bold text-app-text-muted uppercase tracking-widest opacity-60">
                        Loading...
                    </span>
                </div>
            );
        }

        const allIssues = [...githubData.issues].sort(
            (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
        );
        const allPRs = [...githubData.pullRequests].sort(
            (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
        );
        const openIssues = allIssues.filter((i) => i.state === "open");
        const openPRs = allPRs.filter((p) => p.state === "open");

        const issueTrendData = buildTrend(allIssues, (item) =>
            "closedAt" in item ? item.closedAt : null,
        );
        const prTrendData = buildTrend(allPRs, (item) => item.closedAt);

        const visibleIssues = showAllIssues
            ? openIssues
            : openIssues.slice(0, 3);
        const visiblePRs = showAllPRs ? openPRs : openPRs.slice(0, 3);

        const renderIssues = () => (
            <section className="space-y-3">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-semibold text-app-text-muted uppercase tracking-[0.2em]">
                        Issues
                    </h3>
                </div>
                <CommitTrendGraph
                    commits={[...issueTrendData].reverse()}
                    legend={{
                        primaryLabel: "Total",
                        secondaryLabel: "Closed",
                        primaryColor: "#f59e0b",
                        secondaryColor: "#10b981",
                        primaryValuePrefix: "",
                        secondaryValuePrefix: "",
                    }}
                    getPointLabel={(point) =>
                        `Issues: ${point.insertions} total, ${point.deletions} closed`
                    }
                />
                <button
                    type="button"
                    onClick={() => setShowIssuesList((v) => !v)}
                    className="w-full flex items-center gap-2 mt-2 mb-1 px-2 py-1.5 rounded-lg bg-app-surface/50 hover:bg-app-hover transition-colors text-app-text-muted hover:text-app-text-main"
                >
                    <svg
                        width="12"
                        height="12"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="opacity-70 shrink-0"
                    >
                        <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
                        <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" />
                    </svg>
                    <span className="text-[11px] font-medium">View issues</span>
                    {openIssues.length > 0 && (
                        <span className="text-[10px] font-semibold bg-app-hover text-app-text-muted px-1.5 py-0.5 rounded-full">
                            {openIssues.length}
                        </span>
                    )}
                    <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`ml-auto opacity-50 transition-transform duration-200 ${showIssuesList ? "rotate-180" : ""}`}
                    >
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </button>
                {showIssuesList && (
                    <div className="space-y-3">
                        {openIssues.length === 0 ? (
                            <p className="text-[11px] text-app-text-muted italic px-1">
                                No open issues
                            </p>
                        ) : (
                            visibleIssues.map((item) => (
                                <GitHubItemCard
                                    key={`issue-${item.number}`}
                                    item={item}
                                    type="issue"
                                    variant="compact"
                                    formatTime={formatGitHubTime}
                                />
                            ))
                        )}
                        {openIssues.length > 3 && (
                            <button
                                onClick={() => setShowAllIssues(!showAllIssues)}
                                className="w-full py-1.5 text-app-text-muted text-[10px] font-semibold uppercase tracking-widest hover:text-app-text-main transition-colors mt-1"
                            >
                                {showAllIssues
                                    ? "Show Less"
                                    : `Show ${openIssues.length - 3} More Issues`}
                            </button>
                        )}
                    </div>
                )}
            </section>
        );

        const renderPRs = () => (
            <section className="space-y-3">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-semibold text-app-text-muted uppercase tracking-[0.2em]">
                        Pull Requests
                    </h3>
                </div>
                <CommitTrendGraph
                    commits={[...prTrendData].reverse()}
                    legend={{
                        primaryLabel: "Total",
                        secondaryLabel: "Closed",
                        primaryColor: "#a855f7",
                        secondaryColor: "#10b981",
                        primaryValuePrefix: "",
                        secondaryValuePrefix: "",
                    }}
                    getPointLabel={(point) =>
                        `PRs: ${point.insertions} total, ${point.deletions} closed`
                    }
                />
                <button
                    type="button"
                    onClick={() => setShowPRsList((v) => !v)}
                    className="w-full flex items-center gap-2 mt-2 mb-1 px-2 py-1.5 rounded-lg bg-app-surface/50 hover:bg-app-hover transition-colors text-app-text-muted hover:text-app-text-main"
                >
                    <svg
                        width="12"
                        height="12"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="opacity-70 shrink-0"
                    >
                        <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
                    </svg>
                    <span className="text-[11px] font-medium">
                        View pull requests
                    </span>
                    {openPRs.length > 0 && (
                        <span className="text-[10px] font-semibold bg-app-hover text-app-text-muted px-1.5 py-0.5 rounded-full">
                            {openPRs.length}
                        </span>
                    )}
                    <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`ml-auto opacity-50 transition-transform duration-200 ${showPRsList ? "rotate-180" : ""}`}
                    >
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </button>
                {showPRsList && (
                    <div className="space-y-3">
                        {openPRs.length === 0 ? (
                            <p className="text-[11px] text-app-text-muted italic px-1">
                                No active PRs
                            </p>
                        ) : (
                            visiblePRs.map((item) => (
                                <GitHubItemCard
                                    key={`pr-${item.number}`}
                                    item={item}
                                    type="pr"
                                    variant="compact"
                                    formatTime={formatGitHubTime}
                                />
                            ))
                        )}
                        {openPRs.length > 3 && (
                            <button
                                onClick={() => setShowAllPRs(!showAllPRs)}
                                className="w-full py-1.5 text-app-text-muted text-[10px] font-semibold uppercase tracking-widest hover:text-app-text-main transition-colors mt-1"
                            >
                                {showAllPRs
                                    ? "Show Less"
                                    : `Show ${openPRs.length - 3} More PRs`}
                            </button>
                        )}
                    </div>
                )}
            </section>
        );

        if (section === "issues") {
            return (
                <div className="flex flex-col min-h-0">{renderIssues()}</div>
            );
        }

        if (section === "prs") {
            return <div className="flex flex-col min-h-0">{renderPRs()}</div>;
        }

        return (
            <div className="flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-semibold text-app-text-muted uppercase tracking-[0.2em]">
                        Remote Environment
                    </h3>
                </div>

                <div className="space-y-5">
                    {renderIssues()}
                    <div className="pt-3 border-t border-app-border/30">
                        {renderPRs()}
                    </div>
                </div>
            </div>
        );
    }

    if (!isGitHubAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center h-full px-8 text-center select-none">
                <div className="w-16 h-16 rounded-2xl bg-app-surface flex items-center justify-center mb-6 shadow-app-sm border border-app-border">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="w-8 h-8 text-app-text-muted"
                    >
                        <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
                    </svg>
                </div>
                <h3 className="text-sm font-bold text-app-text-main mb-2">
                    GitHub Not Connected
                </h3>
                <p className="text-xs text-app-text-muted max-w-[200px] leading-relaxed mb-6">
                    Connect your GitHub account to see issues and pull requests
                    for this project.
                </p>
                <button
                    onClick={onSignIn}
                    disabled={githubLoading}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-app-accent text-white text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-app-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {githubLoading ? "Connecting…" : "Connect GitHub"}
                </button>
            </div>
        );
    }

    if (githubLoading && !githubData) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-app-accent border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const issues = (githubData?.issues || [])
        .filter((i) => i.state === "open")
        .map((i) => ({ ...i, type: "issue" as const }));
    const prs = (githubData?.pullRequests || [])
        .filter((p) => p.state === "open")
        .map((p) => ({ ...p, type: "pr" as const }));

    const allActivity = [...issues, ...prs].sort(
        (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return (
        <div className="flex flex-col h-full px-24 py-12">
            <header className="flex items-end justify-between mb-12 border-b border-app-border pb-8">
                <div>
                    <h2 className="text-sm font-bold text-app-text-muted uppercase tracking-[0.2em] mb-4">
                        Remote State
                    </h2>
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-app-accent/10 flex items-center justify-center">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 16 16"
                                fill="currentColor"
                                className="w-6 h-6 text-app-accent"
                            >
                                <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-app-text-main leading-tight uppercase truncate max-w-[400px]">
                                {githubData?.repoUrl
                                    ?.split("/")
                                    .slice(-2)
                                    .join("/") || "Repository"}
                            </h3>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    githubData?.repoUrl &&
                                        openExternalUrl(githubData.repoUrl);
                                }}
                                className="text-xs text-app-text-muted hover:text-app-accent transition-colors font-mono tracking-wider opacity-80 cursor-pointer"
                            >
                                {githubData?.repoUrl}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-app-surface/50 rounded-2xl p-4 border border-app-border/30">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <span className="text-xs font-bold text-app-text-muted uppercase tracking-widest opacity-60">
                            Issues
                        </span>
                        <span className="text-sm font-black text-app-text-main">
                            {githubData?.openIssues}
                        </span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 overflow-hidden h-full">
                <div className="lg:col-span-7 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-6 text-xs font-bold text-app-text-muted uppercase tracking-widest">
                        Remote Activity
                    </div>

                    <div className="flex-1 space-y-4 pr-4 overflow-y-auto custom-scrollbar">
                        {allActivity.length === 0 ? (
                            <div className="bg-app-surface/20 rounded-2xl p-12 border border-app-border/20 text-center">
                                <p className="text-sm font-bold text-app-text-muted uppercase tracking-widest opacity-60">
                                    No recent activity
                                </p>
                            </div>
                        ) : (
                            allActivity.map((item) => (
                                <GitHubItemCard
                                    key={`${item.type}-${item.number}`}
                                    item={item}
                                    type={item.type}
                                    formatTime={formatGitHubTime}
                                />
                            ))
                        )}

                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openExternalUrl(
                                        `${githubData?.repoUrl}/issues`,
                                    );
                                }}
                                className="py-4 rounded-2xl border border-app-border/30 bg-app-surface/30 text-app-text-muted text-[10px] text-center font-bold uppercase tracking-widest hover:bg-app-surface/50 transition-colors block w-full"
                            >
                                View All Issues
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openExternalUrl(
                                        `${githubData?.repoUrl}/pulls`,
                                    );
                                }}
                                className="py-4 rounded-2xl border border-app-border/30 bg-app-surface/30 text-app-text-muted text-[10px] text-center font-bold uppercase tracking-widest hover:bg-app-surface/50 transition-colors block w-full"
                            >
                                View All Pull Requests
                            </button>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-5 flex flex-col gap-10 min-h-0">
                    <section className="flex flex-col min-h-0">
                        <h3 className="text-xs font-bold text-app-text-muted uppercase tracking-widest mb-6 px-1">
                            Environment
                        </h3>
                        <div className="bg-app-surface/40 backdrop-blur rounded-3xl p-8 border border-app-border shadow-app-sm">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-app-accent/10 flex items-center justify-center">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 16 16"
                                            fill="currentColor"
                                            className="w-6 h-6 text-app-accent"
                                        >
                                            <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-bold text-app-text-main">
                                        GitHub Production
                                    </span>
                                </div>
                                <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest">
                                    Active
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-app-text-muted font-medium uppercase tracking-widest opacity-60">
                                        Status
                                    </span>
                                    <span className="text-xs font-bold text-app-text-main">
                                        Healthy
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-app-text-muted font-medium uppercase tracking-widest opacity-60">
                                        Sync State
                                    </span>
                                    <span className="text-xs font-bold text-app-text-main uppercase tracking-widest">
                                        All Clear
                                    </span>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
