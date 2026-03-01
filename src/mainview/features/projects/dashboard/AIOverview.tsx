import { useEffect, useState } from "react";
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
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
                            <p className="text-[15px] leading-relaxed text-mac-text/90 font-medium inline">
                                {summary}
                            </p>
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
