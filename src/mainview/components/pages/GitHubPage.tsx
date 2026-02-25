import { useState } from "react";
import type { GitHubData, GitHubIssue, GitHubPR } from "../../../shared/types.ts";
import Tooltip from "../ui/Tooltip.tsx";

interface GitHubPageProps {
    githubData?: GitHubData | null;
    githubLoading?: boolean;
    isGitHubAuthenticated?: boolean;
    isWidget?: boolean;
    section?: 'environment' | 'all';
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

/** Component for a single issue or PR card */
function GitHubItemCard({
    item,
    type,
    variant = 'full'
}: {
    item: GitHubIssue | GitHubPR;
    type: 'issue' | 'pr';
    variant?: 'compact' | 'full';
}) {
    const isPR = type === 'pr';
    const isDraft = isPR && (item as GitHubPR).draft;
    const isCompact = variant === 'compact';

    return (
        <div
            className={`group bg-mac-surface/40 hover:bg-mac-surface/60 backdrop-blur-sm rounded-2xl ${isCompact ? 'p-4' : 'p-6'} border border-mac-border shadow-mac transition-all block scroll-mt-4`}
        >
            <div className="flex items-start gap-4">
                <div className={`${isCompact ? 'w-8 h-8 rounded-lg' : 'w-10 h-10 rounded-xl'} bg-mac-bg flex items-center justify-center shrink-0 border border-mac-border/20 group-hover:border-mac-accent/20 transition-colors`}>
                    {isPR ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={`${isCompact ? 'w-4 h-4' : 'w-5 h-5'} ${isDraft ? 'text-mac-secondary' : 'text-purple-500'} group-hover:text-mac-accent transition-colors`}>
                            <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={`${isCompact ? 'w-4 h-4' : 'w-5 h-5'} text-emerald-500 group-hover:text-mac-accent transition-colors`}>
                            <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
                            <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" />
                        </svg>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className={`flex ${isCompact ? 'items-center' : 'items-start'} justify-between ${isCompact ? 'mb-2' : 'mb-3'}`}>
                        <div className="flex items-center gap-2 min-w-0">
                            <p className={`${isCompact ? 'text-sm truncate' : 'text-base'} text-mac-text font-bold leading-snug transition-colors`}>
                                {item.title}
                            </p>
                            <Tooltip content="Open in GitHub">
                                <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-mac-secondary hover:text-mac-accent transition-colors shrink-0 p-1 hover:bg-mac-accent/10 rounded-md block"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                        <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
                                    </svg>
                                </a>
                            </Tooltip>
                        </div>
                        <span className={`text-[10px] text-mac-secondary font-mono ${isCompact ? 'opacity-60' : 'bg-mac-bg/50 px-2 py-1 rounded-lg border border-mac-border/20'} whitespace-nowrap ml-4`}>
                            {timeAgo(item.createdAt)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className={`${isCompact ? 'text-[10px]' : 'text-xs'} text-mac-secondary font-medium tracking-tight truncate ${isCompact ? 'max-w-[120px]' : ''}`}>
                                {item.user}
                            </span>
                        </div>

                        <div className="flex items-center gap-4">
                            {isDraft && (
                                <div className={`flex items-center gap-1.5 ${isCompact ? 'opacity-80' : 'bg-mac-bg/30 px-3 py-1 rounded-full border border-mac-border/10'}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full bg-mac-secondary`} />
                                    <span className={`${isCompact ? 'text-[9px] font-black' : 'text-[10px] font-bold'} text-mac-secondary uppercase tracking-widest`}>Draft</span>
                                </div>
                            )}
                            <div className={`${isCompact ? 'text-[10px]' : 'text-xs'} text-mac-secondary font-mono bg-mac-bg px-2.5 py-1 rounded-lg border border-mac-border/50`}>
                                #{item.number}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function GitHubPage({
    githubData,
    githubLoading,
    isGitHubAuthenticated = false,
    isWidget = false,
    section = 'all'
}: GitHubPageProps) {
    const [showAllIssues, setShowAllIssues] = useState(false);
    const [showAllPRs, setShowAllPRs] = useState(false);

    if (isWidget && section === 'environment') {
        if (!isGitHubAuthenticated || !githubData) return null;

        const openIssues = githubData.issues.filter(i => i.state === 'open').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const openPRs = githubData.pullRequests.filter(p => p.state === 'open').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const visibleIssues = showAllIssues ? openIssues : openIssues.slice(0, 3);
        const visiblePRs = showAllPRs ? openPRs : openPRs.slice(0, 3);

        return (
            <div className="flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xs font-bold text-mac-secondary uppercase tracking-widest">
                        Remote Environment
                    </h3>
                </div>

                <div className="space-y-8 pr-4">
                    {/* Issues Section */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 px-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <h4 className="text-xs font-black text-mac-secondary uppercase tracking-widest opacity-80">Active Issues</h4>
                        </div>
                        <div className="space-y-3">
                            {openIssues.length === 0 ? (
                                <p className="text-xs text-mac-secondary italic opacity-50 px-1">No open issues</p>
                            ) : (
                                visibleIssues.map(item => (
                                    <GitHubItemCard key={`issue-${item.number}`} item={item} type="issue" variant="compact" />
                                ))
                            )}
                        </div>
                        {openIssues.length > 3 && (
                            <button
                                onClick={() => setShowAllIssues(!showAllIssues)}
                                className="w-full py-3 rounded-2xl border border-mac-border bg-mac-surface/30 text-mac-secondary text-[10px] font-bold uppercase tracking-widest hover:bg-mac-surface/50 transition-colors mt-2"
                            >
                                {showAllIssues ? "Show Less" : `Show ${openIssues.length - 3} More Issues`}
                            </button>
                        )}
                    </section>

                    {/* PRs Section */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 px-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                            <h4 className="text-xs font-black text-mac-secondary uppercase tracking-widest opacity-80">Open Pull Requests</h4>
                        </div>
                        <div className="space-y-3">
                            {openPRs.length === 0 ? (
                                <p className="text-xs text-mac-secondary italic opacity-50 px-1">No active PRs</p>
                            ) : (
                                visiblePRs.map(item => (
                                    <GitHubItemCard key={`pr-${item.number}`} item={item} type="pr" variant="compact" />
                                ))
                            )}
                        </div>
                        {openPRs.length > 3 && (
                            <button
                                onClick={() => setShowAllPRs(!showAllPRs)}
                                className="w-full py-3 rounded-2xl border border-mac-border bg-mac-surface/30 text-mac-secondary text-[10px] font-bold uppercase tracking-widest hover:bg-mac-surface/50 transition-colors mt-2"
                            >
                                {showAllPRs ? "Show Less" : `Show ${openPRs.length - 3} More PRs`}
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
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-8 h-8 text-mac-secondary">
                        <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
                    </svg>
                </div>
                <h3 className="text-sm font-bold text-mac-text mb-2">GitHub Not Connected</h3>
                <p className="text-xs text-mac-secondary max-w-[200px] leading-relaxed">Connect your GitHub account in Settings to see issues and pull requests.</p>
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

    const issues = (githubData?.issues || []).filter(i => i.state === 'open').map(i => ({ ...i, type: 'issue' as const }));
    const prs = (githubData?.pullRequests || []).filter(p => p.state === 'open').map(p => ({ ...p, type: 'pr' as const }));

    // Sort combined activity by created date
    const allActivity = [...issues, ...prs].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return (
        <div className="flex flex-col h-full px-24 py-12">
            <header className="flex items-end justify-between mb-12 border-b border-mac-border pb-8">
                <div>
                    <h2 className="text-sm font-bold text-mac-secondary uppercase tracking-[0.2em] mb-4">Remote State</h2>
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-mac-accent/10 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-6 h-6 text-mac-accent">
                                <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-mac-text leading-tight uppercase truncate max-w-[400px]">
                                {githubData?.repoUrl?.split('/').slice(-2).join('/') || 'Repository'}
                            </h3>
                            <a href={githubData?.repoUrl || '#'} target="_blank" rel="noopener noreferrer" className="text-xs text-mac-secondary hover:text-mac-accent transition-colors font-mono tracking-wider opacity-80">
                                {githubData?.repoUrl}
                            </a>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-mac-surface/50 rounded-2xl p-4 border border-mac-border/30">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <span className="text-xs font-bold text-mac-secondary uppercase tracking-widest opacity-60">Issues</span>
                        <span className="text-sm font-black text-mac-text">{githubData?.openIssues}</span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 overflow-hidden h-full">
                {/* Left: Combined Activity Timeline (Span 7) */}
                <div className="lg:col-span-7 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-6 text-xs font-bold text-mac-secondary uppercase tracking-widest">
                        Remote Activity
                    </div>

                    <div className="flex-1 space-y-4 pr-4 overflow-y-auto custom-scrollbar">
                        {allActivity.length === 0 ? (
                            <div className="bg-mac-surface/20 rounded-2xl p-12 border border-mac-border/20 text-center">
                                <p className="text-sm font-bold text-mac-secondary uppercase tracking-widest opacity-60">No recent activity</p>
                            </div>
                        ) : (
                            allActivity.map(item => (
                                <GitHubItemCard key={`${item.type}-${item.number}`} item={item} type={item.type} />
                            ))
                        )}

                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <a
                                href={`${githubData?.repoUrl}/issues`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="py-4 rounded-2xl border border-mac-border/30 bg-mac-surface/30 text-mac-secondary text-[10px] text-center font-bold uppercase tracking-widest hover:bg-mac-surface/50 transition-colors block"
                            >
                                View All Issues
                            </a>
                            <a
                                href={`${githubData?.repoUrl}/pulls`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="py-4 rounded-2xl border border-mac-border/30 bg-mac-surface/30 text-mac-secondary text-[10px] text-center font-bold uppercase tracking-widest hover:bg-mac-surface/50 transition-colors block"
                            >
                                View All Pull Requests
                            </a>
                        </div>
                    </div>
                </div>

                {/* Right: Environment Summary (Span 5) */}
                <div className="lg:col-span-5 flex flex-col gap-10 min-h-0">
                    <section className="flex flex-col min-h-0">
                        <h3 className="text-xs font-bold text-mac-secondary uppercase tracking-widest mb-6 px-1">
                            Environment
                        </h3>
                        <div className="bg-mac-surface/40 backdrop-blur rounded-3xl p-8 border border-mac-border shadow-mac">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-mac-accent/10 flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-6 h-6 text-mac-accent">
                                            <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-bold text-mac-text">GitHub Production</span>
                                </div>
                                <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest">Active</div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-mac-secondary font-medium uppercase tracking-widest opacity-60">Status</span>
                                    <span className="text-xs font-bold text-mac-text">Healthy</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-mac-secondary font-medium uppercase tracking-widest opacity-60">Sync State</span>
                                    <span className="text-xs font-bold text-mac-text uppercase tracking-widest">All Clear</span>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
