import { useState } from "react";
import { safeJsonParse } from "../../../shared/error.ts";
import { timeAgo } from "../../../shared/time.ts";
import type { GitSnapshot, ProjectStats } from "../../../shared/types.ts";
import CopyableHash from "../../components/ui/CopyableHash.tsx";
import { CommitTrendGraph } from "./CommitTrendGraph.tsx";

interface GitPageProps {
    gitSnapshot?: GitSnapshot | null;
    projectStats?: ProjectStats | null;
    statsLoading?: boolean;
    isWidget?: boolean;
    section?: "timeline" | "workstate" | "all";
}

const formatCommitTime = (dateStr: string | null): string =>
    timeAgo(dateStr, { emptyLabel: "", justNowLabel: "just now", maxDays: 7 });

export default function GitPage({
    gitSnapshot,
    projectStats,
    statsLoading = false,
    isWidget = false,
    section = "all",
}: GitPageProps) {
    const [showAllCommits, setShowAllCommits] = useState(false);
    const [showAllFiles, setShowAllFiles] = useState(false);

    if (isWidget && section === "timeline") {
        const isLoading = statsLoading || projectStats === undefined;
        const allCommits = projectStats?.recentCommits ?? [];
        const commits = showAllCommits ? allCommits : allCommits.slice(0, 5);
        const hasMore = allCommits.length > 5;

        return (
            <div className="flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-semibold text-mac-secondary uppercase tracking-[0.2em]">
                        Commit Timeline
                    </h3>
                </div>

                <CommitTrendGraph
                    commits={allCommits}
                    onExpandAndScroll={(hash) => {
                        setShowAllCommits(true);
                        setTimeout(() => {
                            const el = document.getElementById(
                                `commit-${hash}`,
                            );
                            if (el) {
                                el.scrollIntoView({
                                    behavior: "smooth",
                                    block: "center",
                                });
                                el.classList.add(
                                    "ring-2",
                                    "ring-orange-500/60",
                                );
                                setTimeout(
                                    () =>
                                        el.classList.remove(
                                            "ring-2",
                                            "ring-orange-500/60",
                                        ),
                                    2000,
                                );
                            }
                        }, 100);
                    }}
                />

                <div className="space-y-4 pr-4">
                    {isLoading ? (
                        [1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="bg-transparent rounded-xl p-4 border border-mac-border animate-pulse"
                            >
                                <div className="h-3 bg-mac-border rounded w-3/4 mb-3" />
                                <div className="h-2 bg-mac-border rounded w-1/3" />
                            </div>
                        ))
                    ) : commits.length === 0 ? (
                        <div className="bg-transparent rounded-xl p-6 border border-mac-border text-center">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1}
                                className="w-8 h-8 text-mac-secondary mx-auto mb-3"
                            >
                                <circle cx="12" cy="12" r="3" />
                                <path d="M12 3v6m0 6v6" />
                            </svg>
                            <p className="text-[10px] font-semibold text-mac-secondary uppercase tracking-widest">
                                No recent activity
                            </p>
                        </div>
                    ) : (
                        commits.map((commit) => (
                            <div
                                key={commit.hash}
                                id={`commit-${commit.hash}`}
                                className="bg-transparent rounded-xl p-4 border border-mac-border hover:border-mac-accent/20 transition-colors cursor-default scroll-mt-4"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-transparent flex items-center justify-center shrink-0 border border-mac-border">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 16 16"
                                            fill="currentColor"
                                            className="w-3.5 h-3.5 text-mac-secondary"
                                        >
                                            <path d="M10.5 7.75a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm1.43.75a4.002 4.002 0 01-7.86 0H.75a.75.75 0 110-1.5h3.32a4.001 4.001 0 017.86 0h4.32a.75.75 0 110 1.5h-4.32z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-[13px] text-mac-text font-semibold leading-snug truncate pr-4">
                                                {commit.message}
                                            </p>
                                            <span className="text-[10px] text-mac-secondary font-mono whitespace-nowrap">
                                                {formatCommitTime(
                                                    commit.timestamp,
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[11px] text-mac-secondary truncate max-w-[120px]">
                                                    {commit.author}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                {(commit.insertions > 0 ||
                                                    commit.deletions > 0) && (
                                                    <div className="flex items-center gap-1.5">
                                                        {commit.insertions >
                                                            0 && (
                                                            <span className="text-[9px] font-bold text-green-500">
                                                                +
                                                                {
                                                                    commit.insertions
                                                                }
                                                            </span>
                                                        )}
                                                        {commit.deletions >
                                                            0 && (
                                                            <span className="text-[9px] font-bold text-red-500">
                                                                -
                                                                {
                                                                    commit.deletions
                                                                }
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                <CopyableHash
                                                    hash={commit.hash}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                    {hasMore && !isLoading && (
                        <button
                            onClick={() => setShowAllCommits(!showAllCommits)}
                            className="w-full py-2.5 rounded-xl border border-mac-border bg-transparent text-mac-secondary text-[10px] font-semibold uppercase tracking-widest hover:border-mac-accent/20 transition-colors mt-2"
                        >
                            {showAllCommits
                                ? "Show Less"
                                : `Show ${allCommits.length - 5} More`}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    if (!gitSnapshot) {
        if (isWidget) return null;
        return (
            <div className="flex flex-col items-center justify-center h-full px-8 select-none">
                <div className="w-16 h-16 rounded-2xl bg-mac-surface flex items-center justify-center mb-6 shadow-mac border border-mac-border">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        className="w-8 h-8 text-mac-secondary"
                    >
                        <circle cx="12" cy="12" r="3" />
                        <line x1="12" y1="3" x2="12" y2="9" />
                        <line x1="12" y1="15" x2="12" y2="21" />
                    </svg>
                </div>
                <p className="text-mac-secondary text-sm font-medium">
                    No git documentation found in this project
                </p>
            </div>
        );
    }

    if (isWidget && section === "workstate") {
        const fileData = safeJsonParse<
            Record<
                string,
                { insertions: number; deletions: number; mtime?: string }
            >
        >(
            gitSnapshot?.data,
            {},
            "[GitPage] Failed to parse git snapshot data:",
        );

        const fileTimeAgo = (file: string): string =>
            timeAgo(fileData[file]?.mtime ?? null, {
                emptyLabel: "",
                justNowLabel: "just now",
                maxDays: Number.POSITIVE_INFINITY,
            });

        return (
            <section className="flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-semibold text-mac-secondary uppercase tracking-[0.2em]">
                        Local Environment
                    </h3>
                    {gitSnapshot.uncommittedCount > 0 && (
                        <div className="px-2 py-0.5 rounded border border-mac-border bg-transparent text-orange-400 text-[9px] font-semibold uppercase tracking-widest">
                            {gitSnapshot.uncommittedCount} Unsaved
                        </div>
                    )}
                </div>
                <div className="space-y-3 pr-4">
                    {gitSnapshot.uncommittedCount > 0 ? (
                        <>
                            {(showAllFiles
                                ? gitSnapshot.uncommittedFiles
                                : gitSnapshot.uncommittedFiles.slice(0, 5)
                            ).map((file, i) => {
                                const info = fileData[file];
                                return (
                                    <div
                                        key={i}
                                        className="group bg-transparent rounded-xl p-4 border border-mac-border hover:border-mac-accent/20 transition-colors cursor-default"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0 border border-orange-500/20">
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                    className="w-3.5 h-3.5 text-orange-400"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                                    />
                                                </svg>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-3 mb-1">
                                                    <p className="text-[13px] font-semibold text-mac-text leading-snug truncate">
                                                        {file.split("/").pop()}
                                                    </p>
                                                    <span className="text-[10px] text-mac-secondary font-mono opacity-60 whitespace-nowrap">
                                                        {fileTimeAgo(file)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] text-mac-secondary font-medium tracking-tight truncate">
                                                        {file}
                                                    </span>
                                                    {info && (
                                                        <div className="flex items-center gap-1.5 opacity-80 whitespace-nowrap">
                                                            {info.insertions >
                                                                0 && (
                                                                <span className="text-[9px] font-black text-green-500">
                                                                    +
                                                                    {
                                                                        info.insertions
                                                                    }
                                                                </span>
                                                            )}
                                                            {info.deletions >
                                                                0 && (
                                                                <span className="text-[9px] font-black text-red-500">
                                                                    -
                                                                    {
                                                                        info.deletions
                                                                    }
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {gitSnapshot.uncommittedFiles.length > 5 && (
                                <button
                                    onClick={() =>
                                        setShowAllFiles(!showAllFiles)
                                    }
                                    className="w-full py-2.5 rounded-xl border border-mac-border bg-transparent text-mac-secondary text-[10px] font-semibold uppercase tracking-widest hover:border-mac-accent/20 transition-colors mt-2"
                                >
                                    {showAllFiles
                                        ? "Show Less"
                                        : `Show ${gitSnapshot.uncommittedFiles.length - 5} More`}
                                </button>
                            )}
                        </>
                    ) : (
                        <div className="bg-transparent rounded-xl p-6 border border-mac-border text-center">
                            <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 mb-3 mx-auto border border-orange-500/20">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={3}
                                    className="w-5 h-5"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            </div>
                            <h4 className="text-[13px] font-semibold text-mac-text mb-1">
                                Workspace Clean
                            </h4>
                            <p className="text-[11px] text-mac-secondary max-w-[140px] mx-auto">
                                Synchronized with {gitSnapshot.branch}.
                            </p>
                        </div>
                    )}
                </div>
            </section>
        );
    }

    return (
        <div className="flex flex-col h-full px-24 py-12 select-none">
            <header className="flex items-end justify-between mb-12 border-b border-mac-border pb-8">
                <div>
                    <h2 className="text-sm font-bold text-mac-secondary uppercase tracking-[0.2em] mb-4">
                        Repository State
                    </h2>
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-mac-accent/10 flex items-center justify-center">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                className="w-5 h-5 text-mac-accent"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M4 6h16M4 12h16M4 18h7"
                                />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-mac-text leading-tight">
                                {gitSnapshot.branch}
                            </h3>
                            <p className="text-xs text-mac-secondary font-mono tracking-wider opacity-80">
                                HEAD: {gitSnapshot.lastCommitHash?.slice(0, 7)}
                            </p>
                        </div>
                    </div>
                </div>

                {projectStats?.diffSummary && (
                    <div className="flex items-center gap-4 bg-mac-surface/50 rounded-2xl p-4 border border-mac-border/30">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                            <span className="text-sm font-bold text-mac-text">
                                +{projectStats.diffSummary.insertions}
                            </span>
                        </div>
                        <div className="w-px h-8 bg-mac-border/30" />
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                            <span className="text-sm font-bold text-mac-text">
                                -{projectStats.diffSummary.deletions}
                            </span>
                        </div>
                    </div>
                )}
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 overflow-hidden h-full">
                <div className="lg:col-span-7 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xs font-bold text-mac-secondary uppercase tracking-widest">
                            Commit Timeline
                        </h3>
                    </div>

                    <CommitTrendGraph
                        commits={projectStats?.recentCommits ?? []}
                        onExpandAndScroll={(hash) => {
                            setShowAllCommits(true);
                            setTimeout(() => {
                                const el = document.getElementById(
                                    `commit-${hash}`,
                                );
                                if (el) {
                                    el.scrollIntoView({
                                        behavior: "smooth",
                                        block: "center",
                                    });
                                    el.classList.add(
                                        "ring-2",
                                        "ring-mac-accent/60",
                                    );
                                    setTimeout(
                                        () =>
                                            el.classList.remove(
                                                "ring-2",
                                                "ring-mac-accent/60",
                                            ),
                                        2000,
                                    );
                                }
                            }, 100);
                        }}
                    />

                    <div
                        className={`flex-1 space-y-4 pr-4 custom-scrollbar ${showAllCommits ? "" : "overflow-y-auto"}`}
                    >
                        {(showAllCommits
                            ? (projectStats?.recentCommits ?? [])
                            : (projectStats?.recentCommits?.slice(0, 10) ?? [])
                        ).map((commit) => (
                            <div
                                key={commit.hash}
                                id={`commit-${commit.hash}`}
                                className="group bg-mac-surface/40 hover:bg-mac-surface/60 backdrop-blur-sm rounded-2xl p-6 border border-mac-border hover:border-mac-accent/40 shadow-mac transition-all cursor-default scroll-mt-4"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-mac-bg flex items-center justify-center shrink-0 border border-mac-border/20 group-hover:border-mac-accent/20 transition-colors">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 16 16"
                                            fill="currentColor"
                                            className="w-5 h-5 text-mac-secondary group-hover:text-mac-accent transition-colors"
                                        >
                                            <path d="M10.5 7.75a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm1.43.75a4.002 4.002 0 01-7.86 0H.75a.75.75 0 110-1.5h3.32a4.001 4.001 0 017.86 0h4.32a.75.75 0 110 1.5h-4.32z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between mb-3">
                                            <p className="text-sm text-mac-text font-bold leading-snug">
                                                {commit.message}
                                            </p>
                                            <span className="text-[10px] text-mac-secondary font-mono bg-mac-bg/50 px-2 py-1 rounded-lg border border-mac-border/20 whitespace-nowrap ml-4">
                                                {formatCommitTime(
                                                    commit.timestamp,
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-mac-secondary font-medium tracking-tight">
                                                    {commit.author}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                {(commit.insertions > 0 ||
                                                    commit.deletions > 0) && (
                                                    <div className="flex items-center gap-3 bg-mac-bg/30 px-3 py-1 rounded-full border border-mac-border/10">
                                                        {commit.insertions >
                                                            0 && (
                                                            <div className="flex items-center gap-1">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                                <span className="text-[10px] font-bold text-green-500/90">
                                                                    +
                                                                    {
                                                                        commit.insertions
                                                                    }
                                                                </span>
                                                            </div>
                                                        )}
                                                        {commit.deletions >
                                                            0 && (
                                                            <div className="flex items-center gap-1">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                                                <span className="text-[10px] font-bold text-red-500/90">
                                                                    -
                                                                    {
                                                                        commit.deletions
                                                                    }
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                <CopyableHash
                                                    hash={commit.hash}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {(projectStats?.recentCommits?.length ?? 0) > 10 && (
                            <button
                                onClick={() =>
                                    setShowAllCommits(!showAllCommits)
                                }
                                className="w-full py-4 rounded-2xl border border-mac-border/30 bg-mac-surface/30 text-mac-secondary text-xs font-bold uppercase tracking-widest hover:bg-mac-surface/50 transition-colors"
                            >
                                {showAllCommits
                                    ? "Show Less"
                                    : `Show All ${projectStats?.recentCommits?.length} Commits`}
                            </button>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-5 flex flex-col gap-10 min-h-0">
                    <section className="flex flex-col min-h-0">
                        <h3 className="text-xs font-bold text-mac-secondary uppercase tracking-widest mb-6">
                            Local Environment
                        </h3>
                        <div className="bg-mac-surface/40 backdrop-blur rounded-3xl p-8 border border-mac-border shadow-mac">
                            {gitSnapshot.uncommittedCount > 0 ? (
                                <>
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                                            <span className="text-sm font-bold text-mac-text">
                                                {gitSnapshot.uncommittedCount}{" "}
                                                Modded Files
                                            </span>
                                        </div>
                                        <div className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase tracking-widest">
                                            Unsaved
                                        </div>
                                    </div>
                                    <div className="space-y-2 pr-2 custom-scrollbar flex flex-col">
                                        {(showAllFiles
                                            ? gitSnapshot.uncommittedFiles
                                            : gitSnapshot.uncommittedFiles.slice(
                                                  0,
                                                  8,
                                              )
                                        ).map((file, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center gap-3 px-3 py-2 rounded-xl bg-mac-bg/50 text-xs text-mac-secondary border border-mac-border/20"
                                            >
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                    className="w-3.5 h-3.5 text-amber-500/70"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                                    />
                                                </svg>
                                                <span className="truncate">
                                                    {file.split("/").pop()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    {gitSnapshot.uncommittedFiles.length >
                                        8 && (
                                        <button
                                            onClick={() =>
                                                setShowAllFiles(!showAllFiles)
                                            }
                                            className="w-full mt-6 py-3 text-[10px] font-black text-mac-secondary uppercase tracking-widest hover:text-mac-accent transition-colors border-t border-mac-border/20 pt-6"
                                        >
                                            {showAllFiles
                                                ? "Show Less"
                                                : `+ ${gitSnapshot.uncommittedFiles.length - 8} Additional Changes`}
                                        </button>
                                    )}
                                </>
                            ) : (
                                <div className="flex flex-col items-center py-8 text-center">
                                    <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 mb-4 border border-green-500/20">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth={3}
                                            className="w-8 h-8"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M5 13l4 4L19 7"
                                            />
                                        </svg>
                                    </div>
                                    <h4 className="text-sm font-bold text-mac-text mb-1">
                                        Workspace Synchronized
                                    </h4>
                                    <p className="text-xs text-mac-secondary leading-relaxed max-w-[180px]">
                                        All local changes have been committed or
                                        stashed.
                                    </p>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
