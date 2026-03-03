export interface ActivityChartItem {
    day: string;
    count: number;
}

interface ActivityChartProps {
    dailyCounts: ActivityChartItem[];
    eventCount: number;
    maxCount: number;
    variant: "pulse" | "heartbeat";
}

export default function ActivityChart({
    dailyCounts,
    eventCount,
    maxCount,
    variant,
}: ActivityChartProps) {
    if (variant === "heartbeat") {
        return (
            <div className="bg-app-surface/40 backdrop-blur rounded-3xl p-8 border border-app-border shadow-app-sm mb-12">
                <h4 className="text-sm font-bold text-app-text-main uppercase tracking-widest mb-8">
                    7-Day Heartbeat
                </h4>
                <div className="flex items-end justify-between h-48 gap-4 px-2">
                    {dailyCounts.map((d, i) => (
                        <div
                            key={i}
                            className="flex-1 flex flex-col items-center gap-4 group"
                        >
                            <div className="relative w-full flex flex-col items-center justify-end h-full">
                                <div
                                    className={`w-full max-w-[40px] rounded-t-lg transition-all duration-500 ${i === dailyCounts.length - 1 ? "bg-app-accent shadow-[0_0_20px_hsl(var(--app-accent)_/_0.4)]" : "bg-app-accent/20 group-hover:bg-app-accent/40"}`}
                                    style={{
                                        height: `${(d.count / maxCount) * 100}%`,
                                        minHeight: "8px",
                                    }}
                                />
                                <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-app-surface border border-app-border px-2 py-1 rounded text-[10px] font-bold shadow-app-sm">
                                    {d.count} events
                                </div>
                            </div>
                            <span className="text-[10px] font-bold text-app-text-muted uppercase tracking-widest">
                                {d.day}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-transparent rounded-xl p-4 border border-app-border">
            <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold text-app-text-muted uppercase tracking-widest opacity-60">
                    7-Day Pulse
                </span>
                <span className="text-[10px] font-bold text-app-accent uppercase">
                    {eventCount} events today
                </span>
            </div>
            <div className="flex items-end justify-between h-16 gap-1.5 px-1">
                {dailyCounts.map((d, i) => (
                    <div
                        key={i}
                        className="flex-1 flex flex-col items-center gap-2 group"
                    >
                        <div
                            className={`w-full rounded-t-sm transition-all duration-500 ${i === dailyCounts.length - 1 ? "bg-app-accent shadow-[0_0_12px_hsl(var(--app-accent)_/_0.4)]" : "bg-app-accent/30 group-hover:bg-app-accent/50"}`}
                            style={{
                                height: `${(d.count / maxCount) * 100}%`,
                                minHeight: "4px",
                            }}
                        />
                        <span className="text-[8px] font-bold text-app-text-muted uppercase tracking-tighter opacity-40">
                            {d.day}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
