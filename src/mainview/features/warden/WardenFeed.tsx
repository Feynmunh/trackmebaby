import type { WardenInsightStatus } from "../../../shared/types.ts";

import InsightCard from "./InsightCard.tsx";
import { useWardenInsights } from "./useWardenInsights.ts";

interface WardenFeedProps {
    projectId: string;
}

const TABS = [
    { id: "new", label: "New" },
    { id: "approved", label: "Approved" },
    { id: "liked", label: "Liked" },
] as const satisfies Array<{ id: WardenInsightStatus; label: string }>;

export default function WardenFeed({ projectId }: WardenFeedProps) {
    const {
        insights,
        counts,
        isLoading,
        isAnalyzing,
        hasApiKey,
        error,
        clearError,
        page,
        setPage,
        totalPages,
        activeTab,
        setActiveTab,
        approveInsight,
        dismissInsight,
        likeInsight,
        triggerAnalysis,
    } = useWardenInsights(projectId);

    return (
        <div className="mb-12">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-[10px] font-bold text-app-text-muted uppercase tracking-[0.2em] flex items-center gap-1.5">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-3.5 h-3.5"
                        >
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        Warden
                    </h3>
                </div>
                <button
                    onClick={() => {
                        void triggerAnalysis();
                    }}
                    disabled={isAnalyzing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-app-surface/40 border border-app-border rounded-lg text-app-text-main hover:bg-app-hover disabled:opacity-50 transition-colors shadow-sm"
                >
                    {isAnalyzing ? (
                        <div className="flex gap-1 items-center justify-center w-12">
                            <span
                                className="w-1 h-1 rounded-full bg-app-text-main/70 animate-bounce"
                                style={{ animationDelay: "0ms" }}
                            />
                            <span
                                className="w-1 h-1 rounded-full bg-app-text-main/70 animate-bounce"
                                style={{ animationDelay: "150ms" }}
                            />
                            <span
                                className="w-1 h-1 rounded-full bg-app-text-main/70 animate-bounce"
                                style={{ animationDelay: "300ms" }}
                            />
                        </div>
                    ) : (
                        <>
                            <span>Analyze</span>
                            <span className="text-[10px] opacity-60">↻</span>
                        </>
                    )}
                </button>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center gap-2 text-red-500">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-4 h-4"
                        >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span className="text-[12px] font-medium">{error}</span>
                    </div>
                    <button
                        onClick={clearError}
                        className="text-red-500/60 hover:text-red-500 transition-colors"
                        aria-label="Dismiss error"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-3.5 h-3.5"
                        >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Tab Bar */}
            <div
                className="flex items-center gap-4 mb-4 border-b border-app-border/50"
                role="tablist"
            >
                {TABS.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const count = counts[tab.id as keyof typeof counts];
                    return (
                        <button
                            key={tab.id}
                            role="tab"
                            aria-selected={isActive}
                            aria-controls="warden-tabpanel"
                            id={`warden-tab-${tab.id}`}
                            onKeyDown={(e) => {
                                if (e.key === "ArrowRight") {
                                    const nextIndex =
                                        (TABS.indexOf(tab) + 1) % TABS.length;
                                    setActiveTab(TABS[nextIndex].id);
                                } else if (e.key === "ArrowLeft") {
                                    const prevIndex =
                                        (TABS.indexOf(tab) - 1 + TABS.length) %
                                        TABS.length;
                                    setActiveTab(TABS[prevIndex].id);
                                }
                            }}
                            onClick={() => setActiveTab(tab.id)}
                            className={`pb-2 px-1 text-[13px] font-medium transition-colors ${
                                isActive
                                    ? "text-app-text-main border-b-2 border-app-accent"
                                    : "text-app-text-muted hover:text-app-text-main"
                            }`}
                        >
                            {tab.label} ({count})
                        </button>
                    );
                })}
            </div>

            {/* Content Area */}
            <div
                className="flex flex-col gap-3"
                id="warden-tabpanel"
                role="tabpanel"
                aria-labelledby={`warden-tab-${activeTab}`}
                aria-live="polite"
            >
                {!hasApiKey ? (
                    <div className="bg-app-surface/40 border border-app-border rounded-xl shadow-app-sm p-8 flex flex-col items-center justify-center text-center">
                        <p className="text-app-text-muted text-sm">
                            Configure your AI API key in Settings to enable
                            Warden
                        </p>
                    </div>
                ) : isAnalyzing && insights.length === 0 ? (
                    <div className="bg-app-surface/40 border border-app-border rounded-xl shadow-app-sm p-8 flex flex-col items-center justify-center text-center gap-3">
                        <div className="flex gap-1.5">
                            <span
                                className="w-1.5 h-1.5 rounded-full bg-app-text-muted/50 animate-bounce"
                                style={{ animationDelay: "0ms" }}
                            />
                            <span
                                className="w-1.5 h-1.5 rounded-full bg-app-text-muted/50 animate-bounce"
                                style={{ animationDelay: "150ms" }}
                            />
                            <span
                                className="w-1.5 h-1.5 rounded-full bg-app-text-muted/50 animate-bounce"
                                style={{ animationDelay: "300ms" }}
                            />
                        </div>
                        <p className="text-app-text-muted text-sm">
                            Warden is analyzing your project...
                        </p>
                    </div>
                ) : isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="bg-app-surface/40 border border-app-border rounded-xl shadow-app-sm p-4 h-24 flex flex-col justify-center gap-2.5"
                            >
                                <div className="h-4 bg-app-border/40 rounded w-[90%] animate-pulse" />
                                <div className="h-4 bg-app-border/40 rounded w-[60%] animate-pulse" />
                            </div>
                        ))}
                    </div>
                ) : insights.length === 0 ? (
                    <div className="bg-app-surface/40 border border-app-border rounded-xl shadow-app-sm p-8 flex flex-col items-center justify-center text-center">
                        <p className="text-app-text-muted text-[13px]">
                            {activeTab === "new" &&
                                "No new insights. Warden will analyze your project on the next commit."}
                            {activeTab === "approved" &&
                                "No approved insights yet. Review new insights to approve them."}
                            {activeTab === "liked" &&
                                "No liked insights yet. Like your favorite approved insights."}
                        </p>
                    </div>
                ) : (
                    insights.map((insight) => (
                        <InsightCard
                            key={insight.id}
                            insight={insight}
                            onApprove={
                                activeTab === "new" ? approveInsight : undefined
                            }
                            onDismiss={
                                activeTab === "new" ? dismissInsight : undefined
                            }
                            onLike={
                                activeTab === "approved"
                                    ? likeInsight
                                    : undefined
                            }
                        />
                    ))
                )}

                {/* Pagination Controls */}
                {!isLoading && totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6 px-1">
                        <span className="text-[11px] text-app-text-muted font-medium">
                            Page {page + 1} of {totalPages}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() =>
                                    setPage((p) => Math.max(0, p - 1))
                                }
                                disabled={page === 0}
                                className="px-3 py-1.5 text-[11px] font-semibold bg-app-surface/40 border border-app-border rounded-lg text-app-text-main hover:bg-app-hover disabled:opacity-30 transition-colors shadow-sm"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() =>
                                    setPage((p) =>
                                        Math.min(totalPages - 1, p + 1),
                                    )
                                }
                                disabled={page === totalPages - 1}
                                className="px-3 py-1.5 text-[11px] font-semibold bg-app-surface/40 border border-app-border rounded-lg text-app-text-main hover:bg-app-hover disabled:opacity-30 transition-colors shadow-sm"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
