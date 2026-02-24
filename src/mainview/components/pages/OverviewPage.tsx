import type { Project, GitSnapshot, ProjectStats, ActivityEvent } from "../../../shared/types.ts";

interface OverviewPageProps {
    project: Project;
    gitSnapshot?: GitSnapshot | null;
    projectStats?: ProjectStats | null;
    eventCount: number;
    events: ActivityEvent[];
    isWidget?: boolean;
}

function timeAgo(dateStr: string | null): string {
    if (!dateStr) return "never";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

export default function OverviewPage({
    project,
    gitSnapshot,
    projectStats,
    eventCount,
    events,
    isWidget = false,
}: OverviewPageProps) {
    if (isWidget) {
        // Calculate last 7 days activity chart
        const dailyCounts = Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toDateString();
            const count = events.filter(e => new Date(e.timestamp).toDateString() === dateStr).length;
            return { day: dateStr.slice(0, 3), count };
        }).reverse();

        const maxCount = Math.max(...dailyCounts.map(d => d.count), 1);

        return (
            <div className="space-y-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-mac-secondary uppercase tracking-[0.2em]">Project Vitality</h2>
                    <span className="text-[10px] font-bold text-mac-accent bg-mac-accent/10 px-2 py-0.5 rounded uppercase tracking-widest">Active</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Stat Cards */}
                        <div className="bg-mac-surface/40 backdrop-blur rounded-2xl p-6 border border-mac-border/30 shadow-mac hover:shadow-mac-md transition-all">
                            <div className="w-8 h-8 rounded-lg bg-mac-accent/10 flex items-center justify-center mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-mac-accent">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
                                </svg>
                            </div>
                            <div className="text-2xl font-black text-mac-text mb-1">{projectStats?.branchCount ?? "-"}</div>
                            <div className="text-[10px] font-bold text-mac-secondary uppercase tracking-widest opacity-60">Branches</div>
                        </div>

                        <div className="bg-mac-surface/40 backdrop-blur rounded-2xl p-6 border border-mac-border/30 shadow-mac hover:shadow-mac-md transition-all">
                            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-green-500">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div className="text-2xl font-black text-mac-text mb-1">{projectStats?.totalCommits ?? "-"}</div>
                            <div className="text-[10px] font-bold text-mac-secondary uppercase tracking-widest opacity-60">Commits</div>
                        </div>

                        <div className="bg-mac-surface/40 backdrop-blur rounded-2xl p-6 border border-mac-border/30 shadow-mac hover:shadow-mac-md transition-all">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-amber-500">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div className="text-2xl font-black text-mac-text mb-1">
                                {projectStats?.repoAgeFirstCommit
                                    ? `${Math.floor((Date.now() - new Date(projectStats.repoAgeFirstCommit).getTime()) / (1000 * 60 * 60 * 24))}d`
                                    : "-"
                                }
                            </div>
                            <div className="text-[10px] font-bold text-mac-secondary uppercase tracking-widest opacity-60">Project Age</div>
                        </div>
                    </div>

                    {/* Chart Card */}
                    <div className="lg:col-span-4 bg-mac-surface/40 backdrop-blur rounded-2xl p-6 border border-mac-border/30 shadow-mac">
                        <div className="flex items-center justify-between mb-6">
                            <span className="text-[10px] font-bold text-mac-secondary uppercase tracking-widest opacity-60">7-Day Pulse</span>
                            <span className="text-[10px] font-bold text-mac-accent uppercase">{eventCount} events today</span>
                        </div>
                        <div className="flex items-end justify-between h-20 gap-1.5 px-1">
                            {dailyCounts.map((d, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                                    <div
                                        className={`w-full rounded-t-sm transition-all duration-500 ${i === dailyCounts.length - 1 ? 'bg-mac-accent shadow-[0_0_12px_rgba(0,122,255,0.4)]' : 'bg-mac-accent/30 group-hover:bg-mac-accent/50'}`}
                                        style={{ height: `${(d.count / maxCount) * 100}%`, minHeight: '4px' }}
                                    />
                                    <span className="text-[8px] font-bold text-mac-secondary uppercase tracking-tighter opacity-40">{d.day}</span>
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
                <h2 className="text-sm font-bold text-mac-secondary uppercase tracking-[0.2em] mb-4">Project Overview</h2>
                <div className="flex items-center gap-6">
                    <div className="flex-1">
                        <h3 className="text-3xl font-extrabold text-mac-text tracking-tight mb-2">
                            {project.name}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-mac-secondary font-mono">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                            {project.path}
                        </div>
                    </div>
                    {gitSnapshot && (
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-mac-surface border border-mac-border/50 shadow-mac-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-mac-accent">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
                                </svg>
                                <span className="text-sm font-bold text-mac-text">{gitSnapshot.branch}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                {/* Stat Cards */}
                <div className="bg-mac-surface/40 backdrop-blur rounded-3xl p-8 border border-mac-border/30 shadow-mac hover:shadow-mac-md transition-all">
                    <div className="w-10 h-10 rounded-xl bg-mac-accent/10 flex items-center justify-center mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-mac-accent">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
                        </svg>
                    </div>
                    <div className="text-3xl font-black text-mac-text mb-1">{projectStats?.branchCount ?? "-"}</div>
                    <div className="text-xs font-bold text-mac-secondary uppercase tracking-widest">Active Branches</div>
                </div>

                <div className="bg-mac-surface/40 backdrop-blur rounded-3xl p-8 border border-mac-border/30 shadow-mac hover:shadow-mac-md transition-all">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-green-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div className="text-3xl font-black text-mac-text mb-1">{projectStats?.totalCommits ?? "-"}</div>
                    <div className="text-xs font-bold text-mac-secondary uppercase tracking-widest">Total Commits</div>
                </div>

                <div className="bg-mac-surface/40 backdrop-blur rounded-3xl p-8 border border-mac-border/30 shadow-mac hover:shadow-mac-md transition-all">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-amber-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div className="text-3xl font-black text-mac-text mb-1">
                        {projectStats?.repoAgeFirstCommit
                            ? `${Math.floor((Date.now() - new Date(projectStats.repoAgeFirstCommit).getTime()) / (1000 * 60 * 60 * 24))}d`
                            : "-"
                        }
                    </div>
                    <div className="text-xs font-bold text-mac-secondary uppercase tracking-widest">Project Age</div>
                </div>
            </div>

            {/* Chart Section */}
            <div className="bg-mac-surface/40 backdrop-blur rounded-3xl p-8 border border-mac-border/30 shadow-mac mb-12">
                <h4 className="text-sm font-bold text-mac-text uppercase tracking-widest mb-8">7-Day Heartbeat</h4>
                <div className="flex items-end justify-between h-48 gap-4 px-2">
                    {Array.from({ length: 7 }, (_, i) => {
                        const date = new Date();
                        date.setDate(date.getDate() - i);
                        const dateStr = date.toDateString();
                        const dayEvents = events.filter(e => new Date(e.timestamp).toDateString() === dateStr);
                        const count = dayEvents.length;
                        return { day: dateStr.split(' ')[0], count };
                    }).reverse().map((d, i, arr) => {
                        const max = Math.max(...arr.map(x => x.count), 1);
                        return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-4 group">
                                <div className="relative w-full flex flex-col items-center justify-end h-full">
                                    <div
                                        className={`w-full max-w-[40px] rounded-t-lg transition-all duration-500 ${i === arr.length - 1 ? 'bg-mac-accent shadow-[0_0_20px_rgba(0,122,255,0.4)]' : 'bg-mac-accent/20 group-hover:bg-mac-accent/40'}`}
                                        style={{ height: `${(d.count / max) * 100}%`, minHeight: '8px' }}
                                    />
                                    <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-mac-surface border border-mac-border px-2 py-1 rounded text-[10px] font-bold shadow-mac-sm">
                                        {d.count} events
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold text-mac-secondary uppercase tracking-widest">{d.day}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Bottom Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-mac-surface/40 backdrop-blur rounded-3xl p-8 border border-mac-border/30 shadow-mac">
                    <div className="flex items-center justify-between mb-6">
                        <h4 className="text-sm font-bold text-mac-text uppercase tracking-widest">Recent Activity</h4>
                        <span className="text-lg font-bold text-mac-accent">{eventCount}</span>
                    </div>
                    <div className="w-full h-4 bg-mac-bg/50 rounded-full overflow-hidden mb-4 border border-mac-border/20">
                        <div
                            className="h-full bg-mac-accent transition-all duration-1000 shadow-[0_0_12px_rgba(0,122,255,0.4)]"
                            style={{ width: `${Math.min(100, (eventCount / 50) * 100)}%` }}
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
                        <span className="text-[10px] font-bold text-mac-secondary uppercase tracking-[0.3em]">Last Heartbeat</span>
                        <div className="text-2xl font-bold text-mac-text mt-1">{timeAgo(project.lastActivityAt)}</div>
                    </div>
                    <div className="h-px w-24 bg-mac-border/50 mb-4" />
                    <p className="text-xs text-mac-secondary leading-relaxed max-w-xs">
                        This project was last modified on <span className="text-mac-text font-medium">{project.lastActivityAt ? new Date(project.lastActivityAt).toLocaleDateString() : 'an unknown date'}</span>.
                    </p>
                </div>
            </div>
        </div>
    );
}
