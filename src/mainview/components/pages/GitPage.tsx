import { useState } from "react";
import type { GitSnapshot, ProjectStats } from "../../../shared/types.ts";

interface GitPageProps {
    gitSnapshot?: GitSnapshot | null;
    projectStats?: ProjectStats | null;
    isWidget?: boolean;
    section?: 'timeline' | 'workstate' | 'all';
}

function timeAgo(dateStr: string | null) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}

export default function GitPage({
    gitSnapshot,
    projectStats,
    isWidget = false,
    section = 'all'
}: GitPageProps) {
    const [showAllCommits, setShowAllCommits] = useState(false);
    const [showAllFiles, setShowAllFiles] = useState(false);

    // Timeline widget only needs projectStats.recentCommits — don't gate on gitSnapshot
    if (isWidget && section === 'timeline') {
        const isLoading = projectStats === undefined;
        const allCommits = projectStats?.recentCommits ?? [];
        const commits = showAllCommits ? allCommits : allCommits.slice(0, 5);
        const hasMore = allCommits.length > 5;

        return (
            <div className="flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xs font-bold text-mac-secondary uppercase tracking-widest">
                        Commit Timeline
                    </h3>
                    <span className="text-[10px] font-bold text-mac-accent bg-mac-accent/10 px-2 py-0.5 rounded uppercase tracking-tighter">Recent</span>
                </div>

                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-4 custom-scrollbar">
                    {isLoading ? (
                        /* Loading Skeleton */
                        [1, 2, 3].map(i => (
                            <div key={i} className="bg-mac-surface/40 rounded-2xl p-6 border border-mac-border/30 animate-pulse">
                                <div className="h-3 bg-mac-border/30 rounded w-3/4 mb-3" />
                                <div className="h-2 bg-mac-border/20 rounded w-1/3" />
                            </div>
                        ))
                    ) : commits.length === 0 ? (
                        /* Empty State */
                        <div className="bg-mac-surface/20 rounded-2xl p-8 border border-mac-border/20 text-center">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} className="w-8 h-8 text-mac-secondary/30 mx-auto mb-3">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M12 3v6m0 6v6" />
                            </svg>
                            <p className="text-[10px] font-bold text-mac-secondary uppercase tracking-widest opacity-60">No recent activity</p>
                        </div>
                    ) : (
                        /* Actual Commits */
                        commits.map((commit) => (
                            <div key={commit.hash} className="group bg-mac-surface/40 hover:bg-mac-surface/60 backdrop-blur-sm rounded-2xl p-6 border border-mac-border/30 hover:border-mac-accent/40 shadow-mac transition-all cursor-default">
                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded-lg bg-mac-bg flex items-center justify-center shrink-0 border border-mac-border/20 group-hover:border-mac-accent/20 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-mac-secondary group-hover:text-mac-accent transition-colors">
                                            <circle cx="12" cy="12" r="3" />
                                            <line x1="12" y1="3" x2="12" y2="9" />
                                            <line x1="12" y1="15" x2="12" y2="21" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs text-mac-text font-bold leading-snug truncate pr-4">
                                                {commit.message}
                                            </p>
                                            <span className="text-[10px] text-mac-secondary font-mono whitespace-nowrap opacity-60">
                                                {timeAgo(commit.timestamp)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-full bg-mac-accent/20 flex items-center justify-center text-[8px] text-mac-accent font-black">
                                                    {commit.author[0].toUpperCase()}
                                                </div>
                                                <span className="text-[10px] text-mac-secondary font-medium tracking-tight truncate max-w-[80px]">
                                                    {commit.author.split(' ')[0]}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                {(commit.insertions > 0 || commit.deletions > 0) && (
                                                    <div className="flex items-center gap-1.5 opacity-80">
                                                        {commit.insertions > 0 && (
                                                            <span className="text-[9px] font-black text-green-500">+{commit.insertions}</span>
                                                        )}
                                                        {commit.deletions > 0 && (
                                                            <span className="text-[9px] font-black text-red-500">-{commit.deletions}</span>
                                                        )}
                                                    </div>
                                                )}
                                                <span className="text-[9px] text-mac-secondary font-mono bg-mac-bg px-1.5 py-0.5 rounded border border-mac-border/30 opacity-60">
                                                    {commit.hash.slice(0, 7)}
                                                </span>
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
                            className="w-full py-3 rounded-2xl border border-mac-border/30 bg-mac-surface/30 text-mac-secondary text-[10px] font-bold uppercase tracking-widest hover:bg-mac-surface/50 transition-colors mt-2"
                        >
                            {showAllCommits ? "Show Less" : `Show ${allCommits.length - 5} More`}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    if (!gitSnapshot) {
        if (isWidget) return null; // Widgets hide themselves if no data
        return (
            <div className="flex flex-col items-center justify-center h-full px-8 select-none">
                <div className="w-16 h-16 rounded-2xl bg-mac-surface flex items-center justify-center mb-6 shadow-mac border border-mac-border/30">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-8 h-8 text-mac-secondary">
                        <circle cx="12" cy="12" r="3" />
                        <line x1="12" y1="3" x2="12" y2="9" />
                        <line x1="12" y1="15" x2="12" y2="21" />
                    </svg>
                </div>
                <p className="text-mac-secondary text-sm font-medium">No git documentation found in this project</p>
            </div>
        );
    }

    if (isWidget && section === 'workstate') {
        return (
            <div className="space-y-10">
                <section className="flex flex-col min-h-0">
                    <h3 className="text-xs font-bold text-mac-secondary uppercase tracking-widest mb-6">
                        Local Environment
                    </h3>
                    <div className="bg-mac-surface/40 backdrop-blur rounded-3xl p-6 border border-mac-border/30 shadow-mac">
                        {gitSnapshot.uncommittedCount > 0 ? (
                            <>
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                                        <span className="text-sm font-bold text-mac-text">
                                            {gitSnapshot.uncommittedCount} Modded Files
                                        </span>
                                    </div>
                                    <div className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[9px] font-black uppercase tracking-widest">Unsaved</div>
                                </div>
                                <div className="space-y-2 pr-2 custom-scrollbar flex flex-col">
                                    {(showAllFiles ? gitSnapshot.uncommittedFiles : gitSnapshot.uncommittedFiles.slice(0, 5)).map((file, i) => (
                                        <div key={i} className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-mac-bg/50 text-[11px] text-mac-secondary border border-mac-border/20">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3 text-amber-500/70">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                            <span className="truncate">{file.split('/').pop()}</span>
                                        </div>
                                    ))}
                                </div>
                                {gitSnapshot.uncommittedFiles.length > 5 && (
                                    <button
                                        onClick={() => setShowAllFiles(!showAllFiles)}
                                        className="w-full mt-4 py-2 text-[9px] font-bold text-mac-secondary uppercase tracking-widest hover:text-mac-accent transition-colors border-t border-mac-border/20 pt-4"
                                    >
                                        {showAllFiles ? "Show Less" : `+ ${gitSnapshot.uncommittedFiles.length - 5} More Files`}
                                    </button>
                                )}
                            </>
                        ) : (
                            <div className="flex flex-col items-center py-6 text-center">
                                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 mb-3 border border-green-500/20">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="w-6 h-6">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h4 className="text-xs font-bold text-mac-text mb-1">Workspace Clean</h4>
                                <p className="text-[10px] text-mac-secondary leading-tight max-w-[140px]">Synchronized with {gitSnapshot.branch}.</p>
                            </div>
                        )}
                    </div>
                </section>

                <section className="flex flex-col min-h-0">
                    <h3 className="text-xs font-bold text-mac-secondary uppercase tracking-widest mb-6">
                        Contributors
                    </h3>
                    <div className="bg-mac-surface/40 backdrop-blur rounded-3xl p-4 border border-mac-border/30 shadow-mac">
                        <div className="space-y-2">
                            {projectStats?.contributors?.slice(0, 4).map(c => (
                                <div key={c.name} className="flex items-center justify-between p-2 rounded-xl hover:bg-mac-surface/50 transition-all border border-transparent hover:border-mac-border/30">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-mac-bg flex items-center justify-center text-mac-text font-black border border-mac-border/20 text-xs">
                                            {c.name[0].toUpperCase()}
                                        </div>
                                        <span className="text-xs font-bold text-mac-text tracking-tight">{c.name}</span>
                                    </div>
                                    <span className="text-xs font-black text-mac-accent">{c.commits}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full px-24 py-12 select-none">
            {/* Header: Branch & Diff Summary */}
            <header className="flex items-end justify-between mb-12 border-b border-mac-border/30 pb-8">
                <div>
                    <h2 className="text-sm font-bold text-mac-secondary uppercase tracking-[0.2em] mb-4">Repository State</h2>
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-mac-accent/10 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-mac-accent">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
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
                            <span className="text-sm font-bold text-mac-text">+{projectStats.diffSummary.insertions}</span>
                        </div>
                        <div className="w-px h-8 bg-mac-border/30" />
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                            <span className="text-sm font-bold text-mac-text">-{projectStats.diffSummary.deletions}</span>
                        </div>
                    </div>
                )}
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 overflow-hidden h-full">
                {/* Left: Commit History (Span 7) */}
                <div className="lg:col-span-7 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xs font-bold text-mac-secondary uppercase tracking-widest">
                            Commit Timeline
                        </h3>
                        <span className="text-[10px] font-bold text-mac-accent bg-mac-accent/10 px-2 py-0.5 rounded uppercase tracking-tighter">Recent</span>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-4 pr-4 custom-scrollbar">
                        {(showAllCommits ? (projectStats?.recentCommits ?? []) : (projectStats?.recentCommits?.slice(0, 10) ?? [])).map((commit) => (
                            <div key={commit.hash} className="group bg-mac-surface/40 hover:bg-mac-surface/60 backdrop-blur-sm rounded-2xl p-6 border border-mac-border/30 hover:border-mac-accent/40 shadow-mac transition-all cursor-default">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-mac-bg flex items-center justify-center shrink-0 border border-mac-border/20 group-hover:border-mac-accent/20 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-mac-secondary group-hover:text-mac-accent transition-colors">
                                            <circle cx="12" cy="12" r="3" />
                                            <line x1="12" y1="3" x2="12" y2="9" />
                                            <line x1="12" y1="15" x2="12" y2="21" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between mb-3">
                                            <p className="text-sm text-mac-text font-bold leading-snug">
                                                {commit.message}
                                            </p>
                                            <span className="text-[10px] text-mac-secondary font-mono bg-mac-bg/50 px-2 py-1 rounded-lg border border-mac-border/20 whitespace-nowrap ml-4">
                                                {timeAgo(commit.timestamp)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 h-6 rounded-full bg-mac-accent/20 flex items-center justify-center text-[10px] text-mac-accent font-black">
                                                    {commit.author[0].toUpperCase()}
                                                </div>
                                                <span className="text-xs text-mac-secondary font-medium tracking-tight">{commit.author.split(' ')[0]}</span>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                {(commit.insertions > 0 || commit.deletions > 0) && (
                                                    <div className="flex items-center gap-3 bg-mac-bg/30 px-3 py-1 rounded-full border border-mac-border/10">
                                                        {commit.insertions > 0 && (
                                                            <div className="flex items-center gap-1">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                                <span className="text-[10px] font-bold text-green-500/90">+{commit.insertions}</span>
                                                            </div>
                                                        )}
                                                        {commit.deletions > 0 && (
                                                            <div className="flex items-center gap-1">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                                                <span className="text-[10px] font-bold text-red-500/90">-{commit.deletions}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                <span className="text-[10px] text-mac-secondary font-mono tracking-tighter bg-mac-bg px-2 py-1 rounded border border-mac-border/30">{commit.hash.slice(0, 7)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {(projectStats?.recentCommits?.length ?? 0) > 10 && (
                            <button
                                onClick={() => setShowAllCommits(!showAllCommits)}
                                className="w-full py-4 rounded-2xl border border-mac-border/30 bg-mac-surface/30 text-mac-secondary text-xs font-bold uppercase tracking-widest hover:bg-mac-surface/50 transition-colors"
                            >
                                {showAllCommits ? "Show Less" : `Show All ${projectStats?.recentCommits?.length} Commits`}
                            </button>
                        )}
                    </div>
                </div>

                {/* Right: Working State & Contributors (Span 5) */}
                <div className="lg:col-span-5 flex flex-col gap-10 min-h-0">
                    <section className="flex flex-col min-h-0">
                        <h3 className="text-xs font-bold text-mac-secondary uppercase tracking-widest mb-6">
                            Local Environment
                        </h3>
                        <div className="bg-mac-surface/40 backdrop-blur rounded-3xl p-8 border border-mac-border/30 shadow-mac">
                            {gitSnapshot.uncommittedCount > 0 ? (
                                <>
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                                            <span className="text-sm font-bold text-mac-text">
                                                {gitSnapshot.uncommittedCount} Modded Files
                                            </span>
                                        </div>
                                        <div className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase tracking-widest">Unsaved</div>
                                    </div>
                                    <div className="space-y-2 pr-2 custom-scrollbar flex flex-col">
                                        {(showAllFiles ? gitSnapshot.uncommittedFiles : gitSnapshot.uncommittedFiles.slice(0, 8)).map((file, i) => (
                                            <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-mac-bg/50 text-xs text-mac-secondary border border-mac-border/20">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-amber-500/70">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                                <span className="truncate">{file.split('/').pop()}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {gitSnapshot.uncommittedFiles.length > 8 && (
                                        <button
                                            onClick={() => setShowAllFiles(!showAllFiles)}
                                            className="w-full mt-6 py-3 text-[10px] font-black text-mac-secondary uppercase tracking-widest hover:text-mac-accent transition-colors border-t border-mac-border/20 pt-6"
                                        >
                                            {showAllFiles ? "Show Less" : `+ ${gitSnapshot.uncommittedFiles.length - 8} Additional Changes`}
                                        </button>
                                    )}
                                </>
                            ) : (
                                <div className="flex flex-col items-center py-8 text-center">
                                    <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 mb-4 border border-green-500/20">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="w-8 h-8">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <h4 className="text-sm font-bold text-mac-text mb-1">Workspace Synchronized</h4>
                                    <p className="text-xs text-mac-secondary leading-relaxed max-w-[180px]">All local changes have been committed or stashed.</p>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="flex flex-col min-h-0 flex-1">
                        <h3 className="text-xs font-bold text-mac-secondary uppercase tracking-widest mb-6">
                            Key Contributors
                        </h3>
                        <div className="bg-mac-surface/40 backdrop-blur rounded-3xl p-6 border border-mac-border/30 shadow-mac flex-1 overflow-y-auto custom-scrollbar">
                            <div className="space-y-4">
                                {projectStats?.contributors?.map(c => (
                                    <div key={c.name} className="group flex items-center justify-between p-3 rounded-2xl hover:bg-mac-surface/50 transition-all border border-transparent hover:border-mac-border/30">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-2xl bg-mac-bg flex items-center justify-center text-mac-text font-black border border-mac-border/20 group-hover:border-mac-accent/20 transition-all">
                                                {c.name[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-mac-text tracking-tight">{c.name}</div>
                                                <div className="text-[10px] text-mac-secondary font-bold uppercase tracking-widest opacity-60">Contributor</div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-sm font-black text-mac-accent">{c.commits}</span>
                                            <span className="text-[10px] text-mac-secondary font-bold uppercase tracking-tighter">Commits</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
