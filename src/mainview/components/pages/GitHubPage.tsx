import { useState } from "react";
import { timeAgo } from "../../../shared/time.ts";
import type { GitHubData } from "../../../shared/types.ts";
import { openExternalUrl } from "../../rpc";
import { CommitTrendGraph } from "../charts/CommitTrendGraph.tsx";
import GitHubItemCard from "../ui/GitHubItemCard.tsx";
import { buildTrend } from "../utils/github-trends.ts";

interface GitHubPageProps {
    githubData?: GitHubData | null;
    githubLoading?: boolean;
    isGitHubAuthenticated?: boolean;
    isWidget?: boolean;
    section?: "environment" | "all";
}

const formatGitHubTime = (dateStr: string | null): string =>
    timeAgo(dateStr, { emptyLabel: "", justNowLabel: "just now", maxDays: 7 });

export default function GitHubPage({
    githubData,
    githubLoading,
    isGitHubAuthenticated = false,
    isWidget = false,
    section = "all",
}: GitHubPageProps) {
    const [showAllIssues, setShowAllIssues] = useState(false);
    const [showAllPRs, setShowAllPRs] = useState(false);

    if (isWidget && section === "environment") {
        if (!isGitHubAuthenticated || !githubData) return null;

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
        const prTrendData = buildTrend(allPRs, (item) =>
            "mergedAt" in item ? item.mergedAt : item.closedAt,
        );

        const visibleIssues = showAllIssues
            ? openIssues
            : openIssues.slice(0, 3);
        const visiblePRs = showAllPRs ? openPRs : openPRs.slice(0, 3);

        return (
            <div className="flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-semibold text-mac-secondary uppercase tracking-[0.2em]">
                        Remote Environment
                    </h3>
                </div>

                <div className="space-y-8 pr-4">
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 px-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                            <h4 className="text-[10px] font-semibold text-mac-secondary uppercase tracking-widest">
                                Active Issues
                            </h4>
                        </div>
                        <CommitTrendGraph
                            commits={issueTrendData}
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
                        <div className="space-y-3">
                            {openIssues.length === 0 ? (
                                <p className="text-[11px] text-mac-secondary italic px-1">
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
                        </div>
                        {openIssues.length > 3 && (
                            <button
                                onClick={() => setShowAllIssues(!showAllIssues)}
                                className="w-full py-2.5 rounded-xl border border-mac-border bg-mac-surface text-mac-secondary text-[10px] font-semibold uppercase tracking-widest hover:bg-mac-hover mt-2"
                            >
                                {showAllIssues
                                    ? "Show Less"
                                    : `Show ${openIssues.length - 3} More Issues`}
                            </button>
                        )}
                    </section>

                    <section className="space-y-4">
                        <div className="flex items-center gap-2 px-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                            <h4 className="text-[10px] font-semibold text-mac-secondary uppercase tracking-widest">
                                Open Pull Requests
                            </h4>
                        </div>
                        <CommitTrendGraph
                            commits={prTrendData}
                            legend={{
                                primaryLabel: "Total",
                                secondaryLabel: "Merged",
                                primaryColor: "#a855f7",
                                secondaryColor: "#10b981",
                                primaryValuePrefix: "",
                                secondaryValuePrefix: "",
                            }}
                            getPointLabel={(point) =>
                                `PRs: ${point.insertions} total, ${point.deletions} merged`
                            }
                        />
                        <div className="space-y-3">
                            {openPRs.length === 0 ? (
                                <p className="text-[11px] text-mac-secondary italic px-1">
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
                        </div>
                        {openPRs.length > 3 && (
                            <button
                                onClick={() => setShowAllPRs(!showAllPRs)}
                                className="w-full py-2.5 rounded-xl border border-mac-border bg-mac-surface text-mac-secondary text-[10px] font-semibold uppercase tracking-widest hover:bg-mac-hover mt-2"
                            >
                                {showAllPRs
                                    ? "Show Less"
                                    : `Show ${openPRs.length - 3} More PRs`}
                            </button>
                        )}
                    </section>
                </div>
            </div>
        );
    }

    if (!isGitHubAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center h-full px-8 text-center select-none">
                <div className="w-16 h-16 rounded-2xl bg-mac-surface flex items-center justify-center mb-6 shadow-mac border border-mac-border">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="w-8 h-8 text-mac-secondary"
                    >
                        <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
                    </svg>
                </div>
                <h3 className="text-sm font-bold text-mac-text mb-2">
                    GitHub Not Connected
                </h3>
                <p className="text-xs text-mac-secondary max-w-[200px] leading-relaxed">
                    Connect your GitHub account in Settings to see issues and
                    pull requests.
                </p>
            </div>
        );
    }

    if (githubLoading && !githubData) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-mac-accent border-t-transparent rounded-full animate-spin" />
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
            <header className="flex items-end justify-between mb-12 border-b border-mac-border pb-8">
                <div>
                    <h2 className="text-sm font-bold text-mac-secondary uppercase tracking-[0.2em] mb-4">
                        Remote State
                    </h2>
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-mac-accent/10 flex items-center justify-center">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 16 16"
                                fill="currentColor"
                                className="w-6 h-6 text-mac-accent"
                            >
                                <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-mac-text leading-tight uppercase truncate max-w-[400px]">
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
                                className="text-xs text-mac-secondary hover:text-mac-accent transition-colors font-mono tracking-wider opacity-80 cursor-pointer"
                            >
                                {githubData?.repoUrl}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-mac-surface/50 rounded-2xl p-4 border border-mac-border/30">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <span className="text-xs font-bold text-mac-secondary uppercase tracking-widest opacity-60">
                            Issues
                        </span>
                        <span className="text-sm font-black text-mac-text">
                            {githubData?.openIssues}
                        </span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 overflow-hidden h-full">
                <div className="lg:col-span-7 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-6 text-xs font-bold text-mac-secondary uppercase tracking-widest">
                        Remote Activity
                    </div>

                    <div className="flex-1 space-y-4 pr-4 overflow-y-auto custom-scrollbar">
                        {allActivity.length === 0 ? (
                            <div className="bg-mac-surface/20 rounded-2xl p-12 border border-mac-border/20 text-center">
                                <p className="text-sm font-bold text-mac-secondary uppercase tracking-widest opacity-60">
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
                                className="py-4 rounded-2xl border border-mac-border/30 bg-mac-surface/30 text-mac-secondary text-[10px] text-center font-bold uppercase tracking-widest hover:bg-mac-surface/50 transition-colors block w-full"
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
                                className="py-4 rounded-2xl border border-mac-border/30 bg-mac-surface/30 text-mac-secondary text-[10px] text-center font-bold uppercase tracking-widest hover:bg-mac-surface/50 transition-colors block w-full"
                            >
                                View All Pull Requests
                            </button>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-5 flex flex-col gap-10 min-h-0">
                    <section className="flex flex-col min-h-0">
                        <h3 className="text-xs font-bold text-mac-secondary uppercase tracking-widest mb-6 px-1">
                            Environment
                        </h3>
                        <div className="bg-mac-surface/40 backdrop-blur rounded-3xl p-8 border border-mac-border shadow-mac">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-mac-accent/10 flex items-center justify-center">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 16 16"
                                            fill="currentColor"
                                            className="w-6 h-6 text-mac-accent"
                                        >
                                            <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-bold text-mac-text">
                                        GitHub Production
                                    </span>
                                </div>
                                <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest">
                                    Active
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-mac-secondary font-medium uppercase tracking-widest opacity-60">
                                        Status
                                    </span>
                                    <span className="text-xs font-bold text-mac-text">
                                        Healthy
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-mac-secondary font-medium uppercase tracking-widest opacity-60">
                                        Sync State
                                    </span>
                                    <span className="text-xs font-bold text-mac-text uppercase tracking-widest">
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
