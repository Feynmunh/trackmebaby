import { useRef, useState, useEffect, useCallback } from "react";
import type { Project, GitSnapshot, ActivityEvent, ProjectStats, Worktree, GitHubData, ActivitySummary } from "../../shared/types.ts";
import { getGitHubAuthStatus, getGitHubData, githubStartAuth } from "../rpc";
import OverviewPage from "./pages/OverviewPage";
import GitPage from "./pages/GitPage";
import GitHubPage from "./pages/GitHubPage";


function timeAgo(dateStr: string | null): string {
    if (!dateStr) return "Never";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
}

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
    const pollRef = useRef<Timer | null>(null);
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

    // --- GitHub Integration State ---
    const [isGitHubAuthenticated, setIsGitHubAuthenticated] = useState(false);
    const [githubData, setGithubData] = useState<GitHubData | null>(null);
    const [githubLoading, setGithubLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        let authRetries = 0;
        let dataRetries = 0;

        const fetchGitHubData = async () => {
            if (cancelled) return;
            setGithubLoading(true);
            try {
                const data = await getGitHubData(project.id);
                if (cancelled) return;
                if (data) {
                    setGithubData(data);
                    setGithubLoading(false);
                    return;
                }
            } catch {
            }

            if (cancelled) return;
            dataRetries += 1;
            if (dataRetries <= 3) {
                setTimeout(fetchGitHubData, 400 * dataRetries);
            } else {
                setGithubLoading(false);
            }
        };

        const checkAuthAndLoad = async () => {
            let authenticated = false;
            try {
                const authStatus = await getGitHubAuthStatus();
                if (cancelled) return;
                authenticated = authStatus.authenticated;
                setIsGitHubAuthenticated(authenticated);
                if (!authenticated) {
                    setGithubLoading(false);
                    return;
                }
                dataRetries = 0;
                fetchGitHubData();
            } catch {
                if (cancelled) return;
                setIsGitHubAuthenticated(false);
            }

            if (cancelled) return;
            if (authRetries < 5 && !authenticated) {
                authRetries += 1;
                setTimeout(checkAuthAndLoad, 200 * authRetries);
            }
        };

        checkAuthAndLoad();

        return () => {
            cancelled = true;
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [project.id]);

    const handleGitHubSignIn = useCallback(async () => {
        setGithubLoading(true);
        try {
            const result = await githubStartAuth();
            if (!result.success) {
                setGithubLoading(false);
                return;
            }

            // Poll for auth completion (OAuth happens in browser)
            let attempts = 0;
            pollRef.current = setInterval(async () => {
                attempts++;
                try {
                    const status = await getGitHubAuthStatus();
                    if (status.authenticated) {
                        if (pollRef.current) clearInterval(pollRef.current);
                        pollRef.current = null;
                        setIsGitHubAuthenticated(true);
                        const data = await getGitHubData(project.id);
                        setGithubData(data);
                        setGithubLoading(false);
                    } else if (attempts >= 60) {
                        if (pollRef.current) clearInterval(pollRef.current);
                        pollRef.current = null;
                        setGithubLoading(false);
                    }
                } catch { /* keep polling */ }
            }, 2000);
        } catch (err) {
            console.error("GitHub sign-in failed:", err);
            setGithubLoading(false);
        }
    }, [project.id]);

    return (
        <div className="flex flex-col w-full h-full bg-mac-bg select-none">
            {/* Unified Dashboard Header */}
            <header className="h-20 bg-mac-surface/30 backdrop-blur-md px-12 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-6">
                    <button
                        onClick={onBack}
                        className="w-10 h-10 rounded-xl bg-mac-surface shadow-mac flex items-center justify-center hover:bg-mac-surface/80 transition-all active:scale-95 group"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5 text-mac-accent group-hover:-translate-x-0.5 transition-transform">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                    </button>

                    <div>
                        <h1 className="text-lg font-bold text-mac-text">{project.name}</h1>
                        <p className="text-[10px] text-mac-secondary font-mono truncate max-w-md opacity-80">{project.path}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {hasWorktrees && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 px-2.5 py-1 rounded-full border border-purple-500/20">
                            {project.worktrees.length} worktrees
                        </span>
                    )}
                </div>
            </header>

            {/* Worktree Cards — stacked horizontal row */}
            {hasWorktrees && (
                <div className="bg-mac-surface/20 px-12 py-4 shrink-0">
                    <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-1">
                        {project.worktrees.map((wt) => (
                            <WorktreeCard key={wt.path} worktree={wt} />
                        ))}
                    </div>
                </div>
            )}

            {/* Main Unified Content */}
            <main className="flex-1 overflow-y-auto custom-scrollbar p-12">
                <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">

                    {/* Left Column: Core Stats & Repo History (Span 8) */}
                    <div className="lg:col-span-8 space-y-12">
                        {/* Stats Widgets */}
                        <section>
                            <OverviewPage
                                project={project}
                                gitSnapshot={gitSnapshot}
                                projectStats={projectStats}
                                eventCount={todayEventCount}
                                events={events}
                                activitySummary={activitySummary}
                                isWidget={true}
                                onCommitsClick={() => timelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                onGitHubClick={() => githubRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                isGitHubAuthenticated={isGitHubAuthenticated}
                                githubData={githubData}
                                githubLoading={githubLoading}
                                onGitHubSignIn={isGitHubAuthenticated ? handleGitHubSignIn : (onNavigateToSettings || handleGitHubSignIn)}
                                statsLoading={statsLoading}
                                statsLastUpdated={statsLastUpdated}
                                onRefreshStats={onRefreshStats}
                            />
                        </section>

                        {/* Git History Timeline */}
                        <section ref={timelineRef} className="scroll-mt-12">
                            <GitPage
                                gitSnapshot={gitSnapshot}
                                projectStats={projectStats}
                                isWidget={true}
                                section="timeline"
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
                    <div className="lg:col-span-4 space-y-12">
                        {/* Working State */}
                        <section>
                            <GitPage
                                gitSnapshot={gitSnapshot}
                                projectStats={projectStats}
                                isWidget={true}
                                section="workstate"
                            />
                        </section>

                        {/* Contributors */}
                        <section>
                            <GitPage
                                gitSnapshot={gitSnapshot}
                                projectStats={projectStats}
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

/** Single worktree card shown in the horizontal strip */
function WorktreeCard({ worktree }: { worktree: Worktree }) {
    const isActive = worktree.uncommittedCount > 0;

    return (
        <div className={`
            flex-shrink-0 min-w-[200px] max-w-[280px] rounded-xl px-4 py-3
            border transition-all duration-200
            ${isActive
                ? "bg-mac-accent/5 border-mac-accent/30 shadow-mac-sm"
                : "bg-mac-surface/50 border-mac-border/30"
            }
        `}>
            <div className="flex items-center gap-2 mb-1.5">
                {/* Branch icon */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-mac-accent flex-shrink-0">
                    <path d="M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                    <path d="M18 9c0 6-12 6-12 12" />
                </svg>
                <span className="text-xs font-semibold text-mac-text truncate">{worktree.branch}</span>
                {worktree.isMain && (
                    <span className="text-[8px] font-bold uppercase tracking-wider text-mac-secondary bg-mac-bg px-1.5 py-0.5 rounded">main</span>
                )}
            </div>

            <div className="flex items-center justify-between">
                <span className="text-[10px] text-mac-secondary">
                    {timeAgo(worktree.lastActivityAt)}
                </span>
                {isActive && (
                    <span className="text-[10px] font-semibold text-mac-accent">
                        {worktree.uncommittedCount} changes
                    </span>
                )}
            </div>
        </div>
    );
}
