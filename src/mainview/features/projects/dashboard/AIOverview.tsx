import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { timeAgo } from "../../../../shared/time.ts";
import type { GitSnapshot, Project } from "../../../../shared/types.ts";
import { queryAI } from "../../../rpc.ts";
import DiffView from "./DiffView.tsx";

interface AIOverviewProps {
    project: Project;
    gitSnapshot?: GitSnapshot | null;
    refreshKey?: number;
    compact?: boolean;
    onRefreshStats?: () => void;
    statsLastUpdated?: string;
}

export default function AIOverview({
    project,
    gitSnapshot,
    refreshKey = 0,
    compact = false,
    onRefreshStats,
    statsLastUpdated,
}: AIOverviewProps) {
    const [summary, setSummary] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [showDiffs, setShowDiffs] = useState(false);
    const [summaryError, setSummaryError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        const fetchSummary = async () => {
            setLoading(true);
            setSummaryError(null);
            setSummary(null);
            try {
                const prompt = "Summarize my recent activity in this project.";

                const response = await queryAI(prompt, {
                    task: "project_summary",
                    projectId: project.id,
                });
                if (isMounted) {
                    setSummary(response);
                }
            } catch (err) {
                console.error("Failed to fetch AI summary:", err);
                if (isMounted) {
                    setSummaryError("AI summary unavailable right now.");
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchSummary();

        return () => {
            isMounted = false;
        };
    }, [project.id, refreshKey]);

    const hasUncommitted = (gitSnapshot?.uncommittedCount ?? 0) > 0;

    if (!summary && !loading && !hasUncommitted) return null;

    if (compact) {
        return (
            <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-[9px] font-bold text-app-text-muted uppercase tracking-[0.2em]">
                        Project Pulse
                    </h3>
                    {loading && (
                        <div className="flex gap-1">
                            <span
                                className="w-1 h-1 rounded-full bg-app-text-muted/30 animate-bounce"
                                style={{ animationDelay: "0ms" }}
                            />
                            <span
                                className="w-1 h-1 rounded-full bg-app-text-muted/30 animate-bounce"
                                style={{ animationDelay: "150ms" }}
                            />
                            <span
                                className="w-1 h-1 rounded-full bg-app-text-muted/30 animate-bounce"
                                style={{ animationDelay: "300ms" }}
                            />
                        </div>
                    )}
                </div>
                <div>
                    {loading ? (
                        <div className="space-y-1.5">
                            <div className="h-3 bg-app-border/40 rounded w-[90%] animate-pulse" />
                            <div className="h-3 bg-app-border/40 rounded w-[65%] animate-pulse" />
                        </div>
                    ) : summary ? (
                        <p className="text-[12px] leading-relaxed text-app-text-main/90 font-medium line-clamp-3">
                            {summary}
                        </p>
                    ) : (
                        <p className="text-[11px] text-app-text-muted italic">
                            {summaryError ?? "AI summary unavailable."}
                        </p>
                    )}
                </div>
                {hasUncommitted && gitSnapshot && (
                    <div className="mt-2">
                        <button
                            onClick={() => setShowDiffs(!showDiffs)}
                            className={`p-0 text-[10px] font-semibold tracking-tight leading-none text-left transition-colors group ${
                                showDiffs
                                    ? "text-orange-500"
                                    : "text-app-text-muted hover:text-orange-500"
                            }`}
                        >
                            <span className="underline underline-offset-4 decoration-current/30 group-hover:decoration-orange-500/50">
                                {gitSnapshot.uncommittedCount} file
                                {gitSnapshot.uncommittedCount !== 1 ? "s" : ""}{" "}
                                changed
                            </span>
                        </button>
                        {showDiffs && (
                            <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <DiffView
                                    project={project}
                                    gitSnapshot={gitSnapshot}
                                    refreshKey={refreshKey}
                                    onClose={() => setShowDiffs(false)}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div>
            <div
                className={`rounded-2xl border-2 border-orange-500/70 bg-app-surface/30 px-4 pt-3 relative overflow-hidden transition-all duration-300 ${
                    hasUncommitted && gitSnapshot ? "pb-10" : "pb-3"
                }`}
            >
                <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-[10px] font-bold text-app-text-muted uppercase tracking-[0.2em]">
                        Project Pulse
                    </h3>
                    {loading && (
                        <div className="flex gap-1">
                            <span
                                className="w-1 h-1 rounded-full bg-app-text-muted/30 animate-bounce"
                                style={{ animationDelay: "0ms" }}
                            />
                            <span
                                className="w-1 h-1 rounded-full bg-app-text-muted/30 animate-bounce"
                                style={{ animationDelay: "150ms" }}
                            />
                            <span
                                className="w-1 h-1 rounded-full bg-app-text-muted/30 animate-bounce"
                                style={{ animationDelay: "300ms" }}
                            />
                        </div>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                        {statsLastUpdated && (
                            <span className="text-[10px] text-app-text-muted uppercase tracking-widest">
                                {timeAgo(statsLastUpdated, {
                                    emptyLabel: "never",
                                    justNowLabel: "just now",
                                    maxDays: Number.POSITIVE_INFINITY,
                                })}
                            </span>
                        )}
                        {onRefreshStats && (
                            <button
                                onClick={onRefreshStats}
                                className="px-2 py-0.5 rounded border border-app-border bg-transparent text-[9px] font-bold uppercase tracking-widest text-app-text-muted hover:text-orange-400 hover:border-orange-500/30 transition-colors"
                            >
                                Refresh
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    {loading ? (
                        <div className="space-y-2 mt-2">
                            <div className="h-4 bg-app-border/40 rounded w-[90%] animate-pulse" />
                            <div className="h-4 bg-app-border/40 rounded w-[60%] animate-pulse" />
                        </div>
                    ) : summary ? (
                        <div className="text-[15px] leading-relaxed text-app-text-main/90 font-medium">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    p: ({ children }) => (
                                        <p className="my-2 first:mt-0 last:mb-0">
                                            {children}
                                        </p>
                                    ),
                                    strong: ({ children }) => (
                                        <strong className="font-semibold">
                                            {children}
                                        </strong>
                                    ),
                                    em: ({ children }) => (
                                        <em className="italic">{children}</em>
                                    ),
                                    a: ({ children, href }) => (
                                        <a
                                            href={href}
                                            className="underline decoration-2 underline-offset-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            {children}
                                        </a>
                                    ),
                                    ul: ({ children }) => (
                                        <ul className="list-disc pl-5 space-y-1 my-2">
                                            {children}
                                        </ul>
                                    ),
                                    ol: ({ children }) => (
                                        <ol className="list-decimal pl-5 space-y-1 my-2">
                                            {children}
                                        </ol>
                                    ),
                                    li: ({ children }) => (
                                        <li className="leading-relaxed">
                                            {children}
                                        </li>
                                    ),
                                    code: ({ className, children }) => {
                                        const isBlock =
                                            typeof className === "string" &&
                                            className.includes("language-");
                                        if (isBlock) {
                                            return (
                                                <code className="block w-full overflow-auto rounded-lg bg-app-surface-elevated p-3 font-mono text-[13px] border border-app-border">
                                                    {children}
                                                </code>
                                            );
                                        }
                                        return (
                                            <code className="px-1.5 py-0.5 rounded-md bg-app-surface-elevated font-mono text-[13px]">
                                                {children}
                                            </code>
                                        );
                                    },
                                    pre: ({ children }) => (
                                        <div className="my-3 w-full">
                                            <pre className="block w-full overflow-auto rounded-lg bg-app-surface-elevated p-3 font-mono text-[13px] border border-app-border m-0">
                                                {children as ReactElement}
                                            </pre>
                                        </div>
                                    ),
                                    blockquote: ({ children }) => (
                                        <blockquote className="border-l-4 border-app-border pl-3 ml-1 text-app-text-muted italic">
                                            {children}
                                        </blockquote>
                                    ),
                                    hr: () => (
                                        <hr className="my-4 border-app-border" />
                                    ),
                                }}
                            >
                                {summary}
                            </ReactMarkdown>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-sm text-app-text-muted">
                            {summaryError ?? "AI summary is unavailable."}
                        </div>
                    )}
                </div>

                {hasUncommitted && gitSnapshot && (
                    <div className="absolute bottom-4 left-0 right-0 px-4">
                        <button
                            onClick={() => setShowDiffs(!showDiffs)}
                            className={`
                                p-0 text-[11px] font-semibold tracking-tight leading-none text-left
                                transition-all duration-200 group
                                ${
                                    showDiffs
                                        ? "text-orange-500"
                                        : "text-app-text-muted hover:text-orange-500"
                                }
                            `}
                        >
                            <span className="underline underline-offset-4 decoration-current/30 group-hover:decoration-orange-500/50">
                                {gitSnapshot.uncommittedCount}{" "}
                                {gitSnapshot.uncommittedCount === 1
                                    ? "file"
                                    : "files"}{" "}
                                changed
                            </span>
                        </button>
                    </div>
                )}
            </div>

            {/* Diffs View */}
            {showDiffs && gitSnapshot && (
                <div className="mt-3 animate-in fade-in slide-in-from-top-4 duration-500">
                    <DiffView
                        project={project}
                        gitSnapshot={gitSnapshot}
                        refreshKey={refreshKey}
                        onClose={() => setShowDiffs(false)}
                    />
                </div>
            )}
        </div>
    );
}
