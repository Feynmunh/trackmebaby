import { useState } from "react";
import type { WardenCategory, WardenInsight } from "../../../shared/types.ts";
import Markdown from "../../components/ui/Markdown.tsx";

interface InsightCardProps {
    insight: WardenInsight;
    isExpanded?: boolean;
    flexHeight?: boolean;
    onToggleExpand?: () => void;
    onApprove?: (id: string) => void;
    onDismiss?: (id: string) => void;
    onLike?: (id: string) => void;
}

export default function InsightCard({
    insight,
    isExpanded: controlledIsExpanded,
    flexHeight = false,
    onToggleExpand,
    onApprove,
    onDismiss,
    onLike,
}: InsightCardProps) {
    const [internalIsExpanded, setInternalIsExpanded] = useState(false);

    // Use controlled state if provided, otherwise use internal state
    const isExpanded =
        controlledIsExpanded !== undefined
            ? controlledIsExpanded
            : internalIsExpanded;

    const handleToggleExpand = () => {
        if (onToggleExpand) {
            onToggleExpand();
        } else {
            setInternalIsExpanded(!internalIsExpanded);
        }
    };

    const formatCategory = (cat: WardenCategory) => {
        return cat.replace("_", " ").toUpperCase();
    };

    const hasActions = onApprove || onDismiss;

    return (
        <div
            className={`relative w-full bg-app-surface border border-app-border flex flex-col overflow-hidden text-app-text-main rounded-app-lg shadow-app-lg transition-all ${flexHeight ? "h-auto" : "h-[420px]"}`}
        >
            {/* 1. Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-app-border bg-app-surface-elevated shrink-0">
                <span className="font-mono text-[11px] font-black tracking-[0.3em] text-app-accent">
                    {formatCategory(insight.category)}
                </span>

                <div className="flex items-center gap-1">
                    {/* Like Button (Love) */}
                    {onLike && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onLike(insight.id);
                            }}
                            className={`p-1.5 rounded-md hover:bg-app-hover transition-colors focus:outline-none ${insight.status === "liked" ? "text-pink-500" : "text-app-text-muted hover:text-pink-500"}`}
                            title={
                                insight.status === "liked"
                                    ? "Liked"
                                    : "Like (Arrow Up)"
                            }
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill={
                                    insight.status === "liked"
                                        ? "currentColor"
                                        : "none"
                                }
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="w-4 h-4"
                            >
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* 2. Content Area */}
            <div
                className={`px-6 py-6 flex flex-col gap-4 ${flexHeight ? "" : "overflow-y-auto custom-scrollbar flex-1"}`}
            >
                <h3 className="text-xl font-bold tracking-tight text-app-text-main leading-tight shrink-0">
                    {insight.title}
                </h3>

                <div className="text-app-text-main/80 shrink-0">
                    <Markdown
                        content={insight.description}
                        textSize="text-[14px]"
                    />
                </div>

                {/* 3. Scope View */}
                {insight.affectedFiles && insight.affectedFiles.length > 0 && (
                    <div className="mt-2 shrink-0">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleToggleExpand();
                            }}
                            className="flex items-center justify-between w-full px-3 py-2 rounded-md bg-app-surface-elevated border border-app-border hover:bg-app-hover transition-all group/scope focus:outline-none"
                        >
                            <span className="font-mono text-[9px] font-bold text-app-text-muted uppercase tracking-widest group-hover/scope:text-app-text-main">
                                SCOPE: {insight.affectedFiles.length}{" "}
                                {insight.affectedFiles.length === 1
                                    ? "FILE"
                                    : "FILES"}
                            </span>
                            <div
                                className={`p-0.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="w-3 h-3 text-app-text-muted group-hover/scope:text-app-text-main"
                                >
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </div>
                        </button>

                        {isExpanded && (
                            <div className="mt-3 bg-app-bg border border-app-border p-3 rounded-md overflow-y-auto max-h-40 custom-scrollbar animate-in fade-in slide-in-from-top-1">
                                <ul className="space-y-1.5">
                                    {insight.affectedFiles.map((file, i) => (
                                        <li
                                            key={i}
                                            className="font-mono text-[10px] text-app-text-muted truncate flex items-center gap-2"
                                        >
                                            <span className="text-app-accent/50">
                                                ›
                                            </span>
                                            {file}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 4. Controls */}
            {hasActions && (
                <div className="grid grid-cols-2 border-t border-app-border bg-app-surface-elevated shrink-0 h-14">
                    {onDismiss && (
                        <button
                            onClick={() => onDismiss(insight.id)}
                            className="flex items-center justify-center font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-app-text-muted hover:text-app-text-main hover:bg-app-hover transition-all border-r border-app-border focus:outline-none"
                        >
                            Ignore
                        </button>
                    )}
                    {onApprove && (
                        <button
                            onClick={() => onApprove(insight.id)}
                            className="flex items-center justify-center font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-app-text-muted hover:text-app-accent hover:bg-app-hover transition-all focus:outline-none"
                        >
                            Approve
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
