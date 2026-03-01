import { useState } from "react";
import type { RecentCommit } from "../../../shared/types.ts";

type TrendCommit = Pick<
    RecentCommit,
    "timestamp" | "insertions" | "deletions"
> & {
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

interface CommitTrendGraphProps {
    commits: TrendCommit[];
    onExpandAndScroll?: (hash: string) => void;
    legend?: CommitTrendLegend;
    getPointLabel?: (commit: TrendCommit) => string;
}

export function CommitTrendGraph({
    commits,
    onExpandAndScroll,
    legend,
    getPointLabel,
}: CommitTrendGraphProps) {
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    if (commits.length < 2) return null;

    const data = [...commits].reverse().slice(-20);
    const width = 600;
    const height = 140;
    const paddingTop = 16;
    const paddingBottom = 36;
    const paddingX = 30;
    const chartHeight = height - paddingTop - paddingBottom;

    const maxDelta = Math.max(
        ...data.map((c) => Math.max(c.insertions || 0, c.deletions || 0)),
        10,
    );
    const primaryColor = legend?.primaryColor ?? "#22c55e";
    const secondaryColor = legend?.secondaryColor ?? "#ef4444";
    const primaryLabel = legend?.primaryLabel ?? "Additions";
    const secondaryLabel = legend?.secondaryLabel ?? "Deletions";
    const primaryPrefix = legend?.primaryValuePrefix ?? "+";
    const secondaryPrefix = legend?.secondaryValuePrefix ?? "-";

    const getX = (i: number) =>
        data.length === 1
            ? width / 2
            : (i * (width - 2 * paddingX)) / (data.length - 1) + paddingX;
    const getY = (v: number) =>
        paddingTop + chartHeight - (v * chartHeight) / maxDelta;

    const insPoints = data
        .map((c, i) => `${getX(i)},${getY(c.insertions || 0)}`)
        .join(" ");
    const delPoints = data
        .map((c, i) => `${getX(i)},${getY(c.deletions || 0)}`)
        .join(" ");

    const insArea = `${paddingX},${height - paddingBottom} ${insPoints} ${getX(data.length - 1)},${height - paddingBottom}`;
    const delArea = `${paddingX},${height - paddingBottom} ${delPoints} ${getX(data.length - 1)},${height - paddingBottom}`;

    const formatTime = (ts: string) => {
        const d = new Date(ts);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 0) {
            return d.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            });
        }
        if (diffDays < 7) {
            return d.toLocaleDateString([], { weekday: "short" });
        }
        return d.toLocaleDateString([], { month: "short", day: "numeric" });
    };

    const labelCount = Math.min(5, data.length);
    const labelIndices: number[] = [];
    for (let i = 0; i < labelCount; i++) {
        labelIndices.push(
            Math.round((i * (data.length - 1)) / (labelCount - 1)),
        );
    }

    const hovered = hoveredIdx !== null ? data[hoveredIdx] : null;

    return (
        <div className="rounded-xl p-3 mb-3">
            <div className="flex items-center mb-4">
                <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                        <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: primaryColor }}
                        />
                        <span className="text-[10px] font-bold text-mac-secondary uppercase tracking-widest opacity-60">
                            {primaryLabel}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: secondaryColor }}
                        />
                        <span className="text-[10px] font-bold text-mac-secondary uppercase tracking-widest opacity-60">
                            {secondaryLabel}
                        </span>
                    </div>
                </div>
            </div>

            <div
                className="relative w-full"
                style={{ height: `${height}px` }}
                onMouseLeave={() => setHoveredIdx(null)}
            >
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="w-full h-full overflow-visible"
                    preserveAspectRatio="none"
                >
                    <defs>
                        <linearGradient
                            id="insGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop
                                offset="0%"
                                stopColor={primaryColor}
                                stopOpacity="0.25"
                            />
                            <stop
                                offset="100%"
                                stopColor={primaryColor}
                                stopOpacity="0"
                            />
                        </linearGradient>
                        <linearGradient
                            id="delGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop
                                offset="0%"
                                stopColor={secondaryColor}
                                stopOpacity="0.15"
                            />
                            <stop
                                offset="100%"
                                stopColor={secondaryColor}
                                stopOpacity="0"
                            />
                        </linearGradient>
                    </defs>

                    {[0.25, 0.5, 0.75].map((frac) => (
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
                    <line
                        x1={paddingX}
                        y1={height - paddingBottom}
                        x2={width - paddingX}
                        y2={height - paddingBottom}
                        stroke="currentColor"
                        className="text-mac-border/30"
                        strokeWidth="1"
                    />

                    <polygon points={insArea} fill="url(#insGrad)" />
                    <polygon points={delArea} fill="url(#delGrad)" />

                    <polyline
                        points={insPoints}
                        fill="none"
                        stroke={primaryColor}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <polyline
                        points={delPoints}
                        fill="none"
                        stroke={secondaryColor}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

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

                    {data.map((c, i) => {
                        const isHovered = hoveredIdx === i;
                        const colWidth =
                            data.length > 1
                                ? (width - 2 * paddingX) / (data.length - 1)
                                : width;
                        return (
                            <g key={i}>
                                <rect
                                    x={getX(i) - colWidth / 2}
                                    y={0}
                                    width={colWidth}
                                    height={height}
                                    fill="transparent"
                                    className="cursor-pointer"
                                    onMouseEnter={() => setHoveredIdx(i)}
                                    onClick={() => {
                                        const el = document.getElementById(
                                            `commit-${c.hash}`,
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
                                        } else {
                                            onExpandAndScroll?.(c.hash ?? "");
                                        }
                                    }}
                                />
                                <circle
                                    cx={getX(i)}
                                    cy={getY(c.insertions || 0)}
                                    r={isHovered ? 5 : 3}
                                    fill={
                                        isHovered ? primaryColor : "transparent"
                                    }
                                    stroke={primaryColor}
                                    strokeWidth={isHovered ? 2 : 0}
                                    className="transition-all duration-150"
                                />
                                <circle
                                    cx={getX(i)}
                                    cy={getY(c.deletions || 0)}
                                    r={isHovered ? 5 : 3}
                                    fill={
                                        isHovered
                                            ? secondaryColor
                                            : "transparent"
                                    }
                                    stroke={secondaryColor}
                                    strokeWidth={isHovered ? 2 : 0}
                                    className="transition-all duration-150"
                                />
                            </g>
                        );
                    })}

                    {labelIndices.map((i) => (
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
                            style={{
                                fontFamily: "ui-monospace, monospace",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                            }}
                        >
                            {formatTime(data[i].timestamp)}
                        </text>
                    ))}
                </svg>

                {hoveredIdx !== null && hovered && (
                    <div
                        className="absolute z-50 pointer-events-none animate-in fade-in duration-100"
                        style={{
                            left: `${(getX(hoveredIdx) / width) * 100}%`,
                            top: `${((getY(Math.max(hovered.insertions || 0, hovered.deletions || 0)) - 12) / height) * 100}%`,
                            transform: "translate(-50%, -100%)",
                        }}
                    >
                        <div className="bg-mac-surface border border-mac-border rounded-xl shadow-mac-lg px-3 py-2 min-w-[140px] max-w-[220px]">
                            <p
                                className="text-[10px] text-mac-text font-bold leading-snug mb-1"
                                style={{
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                }}
                            >
                                {getPointLabel
                                    ? getPointLabel(hovered)
                                    : (hovered.message ?? "")}
                            </p>
                            <div className="flex items-center gap-3">
                                <span
                                    className="text-[9px] font-black"
                                    style={{ color: primaryColor }}
                                >
                                    {primaryPrefix}
                                    {hovered.insertions || 0}
                                </span>
                                <span
                                    className="text-[9px] font-black"
                                    style={{ color: secondaryColor }}
                                >
                                    {secondaryPrefix}
                                    {hovered.deletions || 0}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
