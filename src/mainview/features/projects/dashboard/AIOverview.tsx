import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { GitSnapshot, Project } from "../../../../shared/types.ts";
import { queryAI } from "../../../rpc.ts";
import DiffView from "./DiffView.tsx";

interface AIOverviewProps {
    project: Project;
    gitSnapshot?: GitSnapshot | null;
    refreshKey?: number;
}

export default function AIOverview({
    project,
    gitSnapshot,
    refreshKey = 0,
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

    return (
        <div className="mb-12">
            <div className="flex items-center gap-2 mb-3">
                <h3 className="text-[10px] font-bold text-mac-secondary uppercase tracking-[0.2em]">
                    Project Pulse
                </h3>
                {loading && (
                    <div className="flex gap-1">
                        <span
                            className="w-1 h-1 rounded-full bg-mac-secondary/30 animate-bounce"
                            style={{ animationDelay: "0ms" }}
                        />
                        <span
                            className="w-1 h-1 rounded-full bg-mac-secondary/30 animate-bounce"
                            style={{ animationDelay: "150ms" }}
                        />
                        <span
                            className="w-1 h-1 rounded-full bg-mac-secondary/30 animate-bounce"
                            style={{ animationDelay: "300ms" }}
                        />
                    </div>
                )}
            </div>

            <section className="bg-mac-surface/40 backdrop-blur-sm border border-mac-border rounded-2xl p-6 pb-10 shadow-mac-sm relative overflow-hidden transition-all duration-300 max-w-4xl">
                <div className="flex flex-col gap-1">
                    {loading ? (
                        <div className="space-y-2 mt-2">
                            <div className="h-4 bg-mac-border/40 rounded w-[90%] animate-pulse" />
                            <div className="h-4 bg-mac-border/40 rounded w-[60%] animate-pulse" />
                        </div>
                    ) : summary ? (
                        <div className="text-[15px] leading-relaxed text-mac-text/90 font-medium">
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
                                    del: ({ children }) => (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100 border border-amber-200/80 dark:border-amber-500/40 text-[13px] font-mono">
                                            {children}
                                        </span>
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
                                                <code className="block w-full overflow-auto rounded-lg bg-black/5 dark:bg-white/10 p-3 font-mono text-[13px] border border-black/5 dark:border-white/10">
                                                    {children}
                                                </code>
                                            );
                                        }
                                        return (
                                            <code className="px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/10 font-mono text-[13px]">
                                                {children}
                                            </code>
                                        );
                                    },
                                    pre: ({ children }) => (
                                        <div className="my-3 w-full">
                                            <pre className="block w-full overflow-auto rounded-lg bg-black/5 dark:bg-white/10 p-3 font-mono text-[13px] border border-black/5 dark:border-white/10 m-0">
                                                {children as ReactElement}
                                            </pre>
                                        </div>
                                    ),
                                    blockquote: ({ children }) => (
                                        <blockquote className="border-l-4 border-black/10 dark:border-white/20 pl-3 ml-1 text-black/70 dark:text-white/70 italic">
                                            {children}
                                        </blockquote>
                                    ),
                                    hr: () => (
                                        <hr className="my-4 border-black/10 dark:border-white/10" />
                                    ),
                                }}
                            >
                                {summary}
                            </ReactMarkdown>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-sm text-mac-secondary">
                            {summaryError ?? "AI summary is unavailable."}
                        </div>
                    )}
                </div>

                {hasUncommitted && gitSnapshot && (
                    <div className="absolute bottom-4 left-0 right-0 px-6">
                        <button
                            onClick={() => setShowDiffs(!showDiffs)}
                            className={`
                                p-0 text-[11px] font-semibold tracking-tight leading-none text-left
                                transition-all duration-200 group
                                ${
                                    showDiffs
                                        ? "text-orange-500"
                                        : "text-mac-secondary hover:text-orange-500"
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
            </section>

            {/* Pierre-inspired Diffs View */}
            {showDiffs && gitSnapshot && (
                <div className="mt-8 animate-in fade-in slide-in-from-top-4 duration-500">
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
