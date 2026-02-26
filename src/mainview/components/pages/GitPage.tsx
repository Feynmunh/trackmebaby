import { useState } from "react";
import type { GitSnapshot, ProjectStats } from "../../../shared/types.ts";
import Tooltip from "../ui/Tooltip.tsx";

interface GitPageProps {
    gitSnapshot?: GitSnapshot | null;
    projectStats?: ProjectStats | null;
    isWidget?: boolean;
    section?: 'timeline' | 'workstate' | 'contributors' | 'all';
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

type TrendCommit = {
    timestamp: string;
    insertions: number;
    deletions: number;
    message?: string | null;
    hash?: string | null;
};

type CommitTrendLegend = {
    primaryLabel: string;
    secondaryLabel: string;
    primaryColor: string;
    secondaryColor: string;
    primaryValuePrefix?: string;
    secondaryValuePrefix?: string;
};

/** Mini trend graph for additions/deletions */
export function CommitTrendGraph({
    commits,
    onExpandAndScroll,
    legend,
    getPointLabel,
}: {
    commits: TrendCommit[];
    onExpandAndScroll?: (hash: string) => void;
    legend?: CommitTrendLegend;
    getPointLabel?: (commit: TrendCommit) => string;
}) {
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

                    if (commits.length < 2) return null;

    const data = [...commits].reverse().slice(-20);
    const width = 600;
    const height = 140;
    const paddingTop = 16;
    const paddingBottom = 36; // extra room for x-axis labels
    const paddingX = 30;
    const chartHeight = height - paddingTop - paddingBottom;

    const maxDelta = Math.max(...data.map(c => Math.max(c.insertions || 0, c.deletions || 0)), 10);
    const primaryColor = legend?.primaryColor ?? "#22c55e";
    const secondaryColor = legend?.secondaryColor ?? "#ef4444";
    const primaryLabel = legend?.primaryLabel ?? "Additions";
    const secondaryLabel = legend?.secondaryLabel ?? "Deletions";
    const primaryPrefix = legend?.primaryValuePrefix ?? "+";
    const secondaryPrefix = legend?.secondaryValuePrefix ?? "-";

    const getX = (i: number) => data.length === 1 ? width / 2 : (i * (width - 2 * paddingX)) / (data.length - 1) + paddingX;
    const getY = (v: number) => paddingTop + chartHeight - (v * chartHeight) / maxDelta;

    const insPoints = data.map((c, i) => `${getX(i)},${getY(c.insertions || 0)}`).join(' ');
    const delPoints = data.map((c, i) => `${getX(i)},${getY(c.deletions || 0)}`).join(' ');

    // Gradient fill polygons (area under lines)
    const insArea = `${paddingX},${height - paddingBottom} ${insPoints} ${getX(data.length - 1)},${height - paddingBottom}`;
    const delArea = `${paddingX},${height - paddingBottom} ${delPoints} ${getX(data.length - 1)},${height - paddingBottom}`;

    // Format time for x-axis labels
    const formatTime = (ts: string) => {
        const d = new Date(ts);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 0) {
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        if (diffDays < 7) {
            return d.toLocaleDateString([], { weekday: 'short' });
        }
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    // Pick ~5 evenly-spaced x-axis labels to avoid crowding
    const labelCount = Math.min(5, data.length);
    const labelIndices: number[] = [];
    for (let i = 0; i < labelCount; i++) {
        labelIndices.push(Math.round((i * (data.length - 1)) / (labelCount - 1)));
    }

    const hovered = hoveredIdx !== null ? data[hoveredIdx] : null;

    return (
        <div className="bg-mac-surface/40 backdrop-blur rounded-2xl p-6 border border-mac-border shadow-mac mb-6">
            <div className="flex items-center mb-4">
                <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
                        <span className="text-[10px] font-bold text-mac-secondary uppercase tracking-widest opacity-60">{primaryLabel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: secondaryColor }} />
                        <span className="text-[10px] font-bold text-mac-secondary uppercase tracking-widest opacity-60">{secondaryLabel}</span>
                    </div>
                </div>
            </div>

            <div
                className="relative w-full"
                style={{ height: `${height}px` }}
                onMouseLeave={() => setHoveredIdx(null)}
            >
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="insGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={primaryColor} stopOpacity="0.25" />
                            <stop offset="100%" stopColor={primaryColor} stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="delGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={secondaryColor} stopOpacity="0.15" />
                            <stop offset="100%" stopColor={secondaryColor} stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Horizontal grid lines */}
                    {[0.25, 0.5, 0.75].map(frac => (
                        <line
                            key={frac}
                            x1={paddingX}
                            y1={paddingTop + chartHeight * (1 - frac)}
                            x2={width - paddingX}
                            y2={paddingTop + chartHeight * (1 - frac)}
                            stroke="currentColor"
                            className="text-mac-border/20"
                            strokeWidth="0.5"
                            strokeDasharray="4 4"
                        />
                    ))}
                    {/* Baseline */}
                    <line x1={paddingX} y1={height - paddingBottom} x2={width - paddingX} y2={height - paddingBottom} stroke="currentColor" className="text-mac-border/30" strokeWidth="1" />

                    {/* Gradient fills under lines */}
                    <polygon points={insArea} fill="url(#insGrad)" />
                    <polygon points={delArea} fill="url(#delGrad)" />

                    {/* Lines */}
                    <polyline points={insPoints} fill="none" stroke={primaryColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points={delPoints} fill="none" stroke={secondaryColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                    {/* Hover vertical guide line */}
                    {hoveredIdx !== null && (
                        <line
                            x1={getX(hoveredIdx)}
                            y1={paddingTop}
                            x2={getX(hoveredIdx)}
                            y2={height - paddingBottom}
                            stroke="currentColor"
                            className="text-mac-accent/40"
                            strokeWidth="1"
                            strokeDasharray="3 3"
                        />
                    )}

                    {/* Data points + hit areas */}
                    {data.map((c, i) => {
                        const isHovered = hoveredIdx === i;
                        const colWidth = data.length > 1 ? (width - 2 * paddingX) / (data.length - 1) : width;
                        return (
                            <g key={i}>
                                {/* Invisible hit area */}
                                <rect
                                    x={getX(i) - colWidth / 2}
                                    y={0}
                                    width={colWidth}
                                    height={height}
                                    fill="transparent"
                                    className="cursor-pointer"
                                    onMouseEnter={() => setHoveredIdx(i)}
                                    onClick={() => {
                                        const el = document.getElementById(`commit-${c.hash}`);
                                        if (el) {
                                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            el.classList.add('ring-2', 'ring-mac-accent/60');
                                            setTimeout(() => el.classList.remove('ring-2', 'ring-mac-accent/60'), 2000);
                                        } else {
                                            // Commit not visible — expand first, then scroll
                                            onExpandAndScroll?.(c.hash ?? "");
                                        }
                                    }}
                                />
                                {/* Points */}
                                <circle cx={getX(i)} cy={getY(c.insertions || 0)} r={isHovered ? 5 : 3} fill={isHovered ? primaryColor : "transparent"} stroke={primaryColor} strokeWidth={isHovered ? 2 : 0} className="transition-all duration-150" />
                                <circle cx={getX(i)} cy={getY(c.deletions || 0)} r={isHovered ? 5 : 3} fill={isHovered ? secondaryColor : "transparent"} stroke={secondaryColor} strokeWidth={isHovered ? 2 : 0} className="transition-all duration-150" />
                            </g>
                        );
                    })}

                    {/* X-axis time labels */}
                    {labelIndices.map(i => (
                        <text
                            key={i}
                            x={getX(i)}
                            y={height - 6}
                            textAnchor="middle"
                            className="text-mac-secondary"
                            fill="currentColor"
                            fontSize="9"
                            fontWeight="700"
                            opacity="0.4"
                            style={{ fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                        >
                            {formatTime(data[i].timestamp)}
                        </text>
                    ))}
                </svg>

                {/* Hover tooltip */}
                {hoveredIdx !== null && hovered && (
                    <div
                        className="absolute z-50 pointer-events-none animate-in fade-in duration-100"
                        style={{
                            left: `${(getX(hoveredIdx) / width) * 100}%`,
                            top: `${((getY(Math.max(hovered.insertions || 0, hovered.deletions || 0)) - 12) / height) * 100}%`,
                            transform: 'translate(-50%, -100%)',
                        }}
                    >
                        <div className="bg-mac-surface border border-mac-border rounded-xl shadow-mac-lg px-3 py-2 min-w-[140px] max-w-[220px]">
                            <p className="text-[10px] text-mac-text font-bold leading-snug mb-1" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{getPointLabel ? getPointLabel(hovered) : (hovered.message ?? "")}</p>
                            <div className="flex items-center gap-3">
                                <span className="text-[9px] font-black" style={{ color: primaryColor }}>{primaryPrefix}{hovered.insertions || 0}</span>
                                <span className="text-[9px] font-black" style={{ color: secondaryColor }}>{secondaryPrefix}{hovered.deletions || 0}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/** Copyable hash button with tooltip */
function CopyableHash({ hash }: { hash: string }) {
    const [copied, setCopied] = useState(false);

    const copy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(hash);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Tooltip content={copied ? "Copied!" : "Click to copy"}>
            <button
                onClick={copy}
                className="text-xs text-mac-secondary font-mono bg-mac-bg px-2.5 py-1 rounded-lg border border-mac-border/50 hover:border-mac-accent/40 hover:text-mac-accent transition-all block"
            >
                {hash.slice(0, 7)}
            </button>
        </Tooltip>
    );
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
                </div>

                <CommitTrendGraph commits={allCommits} onExpandAndScroll={(hash) => {
                    setShowAllCommits(true);
                    setTimeout(() => {
                        const el = document.getElementById(`commit-${hash}`);
                        if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            el.classList.add('ring-2', 'ring-mac-accent/60');
                            setTimeout(() => el.classList.remove('ring-2', 'ring-mac-accent/60'), 2000);
                        }
                    }, 100);
                }} />

                <div className="space-y-4 pr-4">
                    {isLoading ? (
                        /* Loading Skeleton */
                        [1, 2, 3].map(i => (
                            <div key={i} className="bg-mac-surface/40 rounded-2xl p-6 border border-mac-border animate-pulse">
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
                            <div key={commit.hash} id={`commit-${commit.hash}`} className="group bg-mac-surface/40 hover:bg-mac-surface/60 backdrop-blur-sm rounded-2xl p-6 border border-mac-border hover:border-mac-accent/40 shadow-mac transition-all cursor-default scroll-mt-4">
                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded-lg bg-mac-bg flex items-center justify-center shrink-0 border border-mac-border/20 group-hover:border-mac-accent/20 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-mac-secondary group-hover:text-mac-accent transition-colors">
                                            <path d="M10.5 7.75a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm1.43.75a4.002 4.002 0 01-7.86 0H.75a.75.75 0 110-1.5h3.32a4.001 4.001 0 017.86 0h4.32a.75.75 0 110 1.5h-4.32z" />
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
                                                <span className="text-[10px] text-mac-secondary font-medium tracking-tight truncate max-w-[120px]">
                                                    {commit.author}
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
                                                <CopyableHash hash={commit.hash} />
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
                            className="w-full py-3 rounded-2xl border border-mac-border bg-mac-surface/30 text-mac-secondary text-[10px] font-bold uppercase tracking-widest hover:bg-mac-surface/50 transition-colors mt-2"
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
                <div className="w-16 h-16 rounded-2xl bg-mac-surface flex items-center justify-center mb-6 shadow-mac border border-mac-border">
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
        const [showAllFiles, setShowAllFiles] = useState(false);

        const fileData: Record<string, { insertions: number; deletions: number; mtime?: string }> = (() => {
            if (!gitSnapshot?.data) return {};
            if (!gitSnapshot.data) return {};
            try {
                const parsed = JSON.parse(gitSnapshot.data);
                if (typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
            } catch { }
            return {};
        })();

        const fileTimeAgo = (file: string): string => {
            const info = fileData[file];
            if (!info?.mtime) return "";
            const diff = Date.now() - new Date(info.mtime).getTime();
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);
            const days = Math.floor(diff / 86400000);
            if (minutes < 1) return "just now";
            if (minutes < 60) return `${minutes}m ago`;
            if (hours < 24) return `${hours}h ago`;
            return `${days}d ago`;
        };

        return (
            <section className="flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xs font-bold text-mac-secondary uppercase tracking-widest">
                        Local Environment
                    </h3>
                    {gitSnapshot.uncommittedCount > 0 && (
                        <div className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[9px] font-black uppercase tracking-widest">
                            {gitSnapshot.uncommittedCount} Unsaved
                        </div>
                    )}
                </div>
                <div className="space-y-4 pr-4">
                    {gitSnapshot.uncommittedCount > 0 ? (
                        <>
                            {(showAllFiles ? gitSnapshot.uncommittedFiles : gitSnapshot.uncommittedFiles.slice(0, 5)).map((file, i) => {
                                const info = fileData[file];
                                return (
                                    <div key={i} className="group bg-mac-surface/40 hover:bg-mac-surface/60 backdrop-blur-sm rounded-2xl p-6 border border-mac-border hover:border-mac-accent/40 shadow-mac transition-all cursor-default">
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20 group-hover:border-mac-accent/20 transition-colors">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-amber-500 group-hover:text-mac-accent transition-colors">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-3 mb-2">
                                                    <p className="text-sm font-bold text-mac-text leading-snug truncate">
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
                                                            {info.insertions > 0 && (
                                                                <span className="text-[9px] font-black text-green-500">+{info.insertions}</span>
                                                            )}
                                                            {info.deletions > 0 && (
                                                                <span className="text-[9px] font-black text-red-500">-{info.deletions}</span>
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
                                    onClick={() => setShowAllFiles(!showAllFiles)}
                                    className="w-full py-3 rounded-2xl border border-mac-border bg-mac-surface/30 text-mac-secondary text-[10px] font-bold uppercase tracking-widest hover:bg-mac-surface/50 transition-colors mt-2"
                                >
                                    {showAllFiles ? "Show Less" : `Show ${gitSnapshot.uncommittedFiles.length - 5} More`}
                                </button>
                            )}
                        </>
                    ) : (
                        <div className="bg-mac-surface/20 rounded-2xl p-8 border border-mac-border/20 text-center">
                            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 mb-3 mx-auto border border-green-500/20">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h4 className="text-xs font-bold text-mac-text mb-1">Workspace Clean</h4>
                            <p className="text-[10px] text-mac-secondary leading-tight max-w-[140px] mx-auto">Synchronized with {gitSnapshot.branch}.</p>
                        </div>
                    )}
                </div>
            </section>
        );
    }

    if (isWidget && section === 'contributors') {
        return (
            <section className="flex flex-col min-h-0">
                <h3 className="text-xs font-bold text-mac-secondary uppercase tracking-widest mb-6">
                    Contributors
                </h3>
                <div className="bg-mac-surface/40 backdrop-blur rounded-3xl p-4 border border-mac-border shadow-mac">
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
        );
    }

    return (
        <div className="flex flex-col h-full px-24 py-12 select-none">
            {/* Header: Branch & Diff Summary */}
            <header className="flex items-end justify-between mb-12 border-b border-mac-border pb-8">
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
                    </div>

                    <CommitTrendGraph commits={projectStats?.recentCommits ?? []} onExpandAndScroll={(hash) => {
                        setShowAllCommits(true);
                        setTimeout(() => {
                            const el = document.getElementById(`commit-${hash}`);
                            if (el) {
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                el.classList.add('ring-2', 'ring-mac-accent/60');
                                setTimeout(() => el.classList.remove('ring-2', 'ring-mac-accent/60'), 2000);
                            }
                        }, 100);
                    }} />

                    <div className={`flex-1 space-y-4 pr-4 custom-scrollbar ${showAllCommits ? '' : 'overflow-y-auto'}`}>
                        {(showAllCommits ? (projectStats?.recentCommits ?? []) : (projectStats?.recentCommits?.slice(0, 10) ?? [])).map((commit) => (
                            <div key={commit.hash} id={`commit-${commit.hash}`} className="group bg-mac-surface/40 hover:bg-mac-surface/60 backdrop-blur-sm rounded-2xl p-6 border border-mac-border hover:border-mac-accent/40 shadow-mac transition-all cursor-default scroll-mt-4">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-mac-bg flex items-center justify-center shrink-0 border border-mac-border/20 group-hover:border-mac-accent/20 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5 text-mac-secondary group-hover:text-mac-accent transition-colors">
                                            <path d="M10.5 7.75a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm1.43.75a4.002 4.002 0 01-7.86 0H.75a.75.75 0 110-1.5h3.32a4.001 4.001 0 017.86 0h4.32a.75.75 0 110 1.5h-4.32z" />
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
                                                <span className="text-xs text-mac-secondary font-medium tracking-tight">{commit.author}</span>
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
                                                <CopyableHash hash={commit.hash} />
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
                        <div className="bg-mac-surface/40 backdrop-blur rounded-3xl p-8 border border-mac-border shadow-mac">
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
                        <div className="bg-mac-surface/40 backdrop-blur rounded-3xl p-6 border border-mac-border shadow-mac flex-1 overflow-y-auto custom-scrollbar">
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
