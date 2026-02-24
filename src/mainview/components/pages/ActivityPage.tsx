import type { ActivityEvent, ProjectStats } from "../../../shared/types.ts";

interface ActivityPageProps {
    events: ActivityEvent[];
    projectStats?: ProjectStats | null;
    isWidget?: boolean;
}

function formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

const EVENT_ICONS: Record<string, JSX.Element> = {
    file_create: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
    ),
    file_delete: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
    ),
    file_modify: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
    )
};

const EVENT_COLORS: Record<string, string> = {
    file_create: "text-green-500 bg-green-500/10",
    file_delete: "text-red-500 bg-red-500/10",
    file_modify: "text-mac-accent bg-mac-accent/10"
};

/** Group events by day label ("Today", "Yesterday", or date string) */
function groupByDay(events: ActivityEvent[]): { label: string; events: ActivityEvent[] }[] {
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now.getTime() - 86400000).toDateString();

    const groups: Map<string, ActivityEvent[]> = new Map();

    for (const ev of events) {
        const ds = new Date(ev.timestamp).toDateString();
        let label: string;
        if (ds === today) label = "Today";
        else if (ds === yesterday) label = "Yesterday";
        else label = ds;

        if (!groups.has(label)) groups.set(label, []);
        groups.get(label)!.push(ev);
    }

    return Array.from(groups.entries()).map(([label, events]) => ({
        label,
        events,
    }));
}

/** Extract filename from a full path */
function basename(filePath: string): string {
    const parts = filePath.split("/");
    return parts[parts.length - 1] || filePath;
}

export default function ActivityPage({ events, isWidget = false }: ActivityPageProps) {
    if (events.length === 0) {
        if (isWidget) return null;
        return (
            <div className="flex flex-col items-center justify-center h-full px-8 select-none">
                <div className="w-16 h-16 rounded-2xl bg-mac-surface flex items-center justify-center mb-6 shadow-mac border border-mac-border">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-8 h-8 text-mac-secondary">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                </div>
                <p className="text-mac-secondary text-sm font-medium">No activity tracked in the last 48 hours</p>
            </div>
        );
    }

    const groups = groupByDay(events);

    // Calculate file type distribution
    const fileTypes = events.reduce((acc, ev) => {
        const ext = ev.filePath.split('.').pop()?.toLowerCase() || 'other';
        acc[ext] = (acc[ext] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const sortedTypes = Object.entries(fileTypes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    const totalEvents = events.length;

    if (isWidget) {
        return (
            <div className="space-y-8">
                <h3 className="text-xs font-bold text-mac-secondary uppercase tracking-widest mb-6 border-b border-mac-border/30 pb-4">
                    Workspace Focus
                </h3>
                <div className="bg-mac-surface/40 backdrop-blur rounded-3xl p-6 border border-mac-border shadow-mac">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-bold text-mac-secondary uppercase tracking-widest">Type Distribution</span>
                        <div className="flex -space-x-1">
                            {sortedTypes.map(([ext], i) => (
                                <div key={ext} className={`w-4 h-4 rounded-full border border-mac-surface flex items-center justify-center text-[6px] font-bold text-white ${i === 0 ? 'bg-mac-accent' : i === 1 ? 'bg-mac-accent/70' : 'bg-mac-accent/40'
                                    }`}>
                                    {ext[0].toUpperCase()}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="w-full h-2 bg-mac-bg/50 rounded-full overflow-hidden flex border border-mac-border/20 mb-6">
                        {sortedTypes.map(([ext, count], i) => (
                            <div
                                key={ext}
                                className={`h-full transition-all duration-1000 ${i === 0 ? 'bg-mac-accent' :
                                    i === 1 ? 'bg-mac-accent/70' :
                                        i === 2 ? 'bg-mac-accent/50' :
                                            i === 3 ? 'bg-mac-accent/30' : 'bg-mac-accent/10'
                                    }`}
                                style={{ width: `${(count / totalEvents) * 100}%` }}
                                title={`${ext}: ${count} events`}
                            />
                        ))}
                    </div>
                    <div className="space-y-3">
                        {sortedTypes.map(([ext, count], i) => (
                            <div key={ext} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-mac-accent' : i === 1 ? 'bg-mac-accent/70' : 'bg-mac-accent/40'
                                        }`} />
                                    <span className="text-[10px] font-bold text-mac-text uppercase tracking-tight">.{ext}</span>
                                </div>
                                <span className="text-[10px] text-mac-secondary font-bold tabular-nums tracking-tighter">{Math.round((count / totalEvents) * 100)}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full px-24 py-12 select-none">
            {/* Header / Summary Section */}
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-16 border-b border-mac-border pb-10">
                <div className="max-w-md">
                    <h2 className="text-sm font-bold text-mac-secondary uppercase tracking-[0.2em] mb-4">Activity Insights</h2>
                    <h3 className="text-2xl font-black text-mac-text mb-3">Development Focus</h3>
                    <p className="text-xs text-mac-secondary leading-relaxed">
                        An analysis of your most recent file-system interactions. Showing the last <span className="text-mac-text font-bold">{totalEvents}</span> events across your workspace.
                    </p>
                </div>

                <div className="bg-mac-surface/40 backdrop-blur rounded-3xl p-8 border border-mac-border shadow-mac flex-1 lg:max-w-sm">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-bold text-mac-secondary uppercase tracking-widest">Type Distribution</span>
                        <div className="flex -space-x-1">
                            {sortedTypes.map(([ext], i) => (
                                <div key={ext} className={`w-5 h-5 rounded-full border-2 border-mac-surface flex items-center justify-center text-[8px] font-bold text-white ${i === 0 ? 'bg-mac-accent' : i === 1 ? 'bg-mac-accent/70' : 'bg-mac-accent/40'
                                    }`}>
                                    {ext[0].toUpperCase()}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="w-full h-3 bg-mac-bg/50 rounded-full overflow-hidden flex border border-mac-border/20 mb-4">
                        {sortedTypes.map(([ext, count], i) => (
                            <div
                                key={ext}
                                className={`h-full transition-all duration-1000 ${i === 0 ? 'bg-mac-accent' :
                                    i === 1 ? 'bg-mac-accent/70' :
                                        i === 2 ? 'bg-mac-accent/50' :
                                            i === 3 ? 'bg-mac-accent/30' : 'bg-mac-accent/10'
                                    }`}
                                style={{ width: `${(count / totalEvents) * 100}%` }}
                                title={`${ext}: ${count} events`}
                            />
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {sortedTypes.map(([ext, count], i) => (
                            <div key={ext} className="flex items-center gap-1.5 min-w-[60px]">
                                <div className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-mac-accent' : i === 1 ? 'bg-mac-accent/70' : 'bg-mac-accent/40'
                                    }`} />
                                <span className="text-[10px] font-bold text-mac-text uppercase tracking-tighter">.{ext}</span>
                                <span className="text-[10px] text-mac-secondary font-medium ml-auto">{Math.round((count / totalEvents) * 100)}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </header>

            {/* Timeline Section */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-6 custom-scrollbar">
                <div className="max-w-4xl mx-auto">
                    {groups.map((group) => (
                        <div key={group.label} className="mb-12">
                            <div className="flex items-center gap-4 mb-8">
                                <h4 className="text-xs font-black text-mac-secondary uppercase tracking-[0.2em]">{group.label}</h4>
                                <div className="h-px flex-1 bg-mac-border" />
                            </div>

                            <div className="space-y-4">
                                {group.events.map((ev) => {
                                    const icon = EVENT_ICONS[ev.type] || EVENT_ICONS.file_modify;
                                    const colorClass = EVENT_COLORS[ev.type] || EVENT_COLORS.file_modify;

                                    return (
                                        <div
                                            key={ev.id}
                                            className="group flex items-center gap-6 p-4 rounded-2xl hover:bg-mac-surface/50 border border-transparent hover:border-mac-border transition-all cursor-default"
                                        >
                                            <div className="w-16 shrink-0 text-[10px] font-bold text-mac-secondary font-mono tracking-tighter tabular-nums opacity-60 group-hover:opacity-100 transition-opacity">
                                                {formatTime(ev.timestamp)}
                                            </div>

                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-transparent transition-all ${colorClass}`}>
                                                {icon}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-bold text-mac-text truncate mb-1" title={ev.filePath}>
                                                    {basename(ev.filePath)}
                                                </div>
                                                <div className="text-[10px] text-mac-secondary font-medium truncate opacity-60">
                                                    {ev.filePath.replace(basename(ev.filePath), '')}
                                                </div>
                                            </div>

                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-mac-secondary hover:text-mac-accent">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                                </svg>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
