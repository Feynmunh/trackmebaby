import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { WardenInsightStatus } from "../../../shared/types.ts";
import { useToast } from "../../components/ui/Toast.tsx";
import InsightCard from "./InsightCard.tsx";
import SwipeableCard from "./SwipeableCard.tsx";
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
        allInsights,
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
        unlikeInsight,
        triggerAnalysis,
    } = useWardenInsights(projectId);

    const { showToast } = useToast();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [triagedCount, setTriagedCount] = useState(0);
    const [selectedTag, setSelectedTag] = useState<string | null>(null);

    // Reset triage state and filters when tab changes
    useEffect(() => {
        setTriagedCount(0);
        setSelectedTag(null);
    }, [activeTab]);

    // Reset triage count when analysis starts
    useEffect(() => {
        if (isAnalyzing) setTriagedCount(0);
    }, [isAnalyzing]);

    const handleApprove = useCallback(
        (id: string) => {
            setTriagedCount((prev) => prev + 1);
            showToast("Approved", "approve");
            void approveInsight(id);
        },
        [approveInsight, showToast],
    );

    const handleDismiss = useCallback(
        (id: string) => {
            setTriagedCount((prev) => prev + 1);
            showToast("Ignored", "dismiss");
            void dismissInsight(id);
        },
        [dismissInsight, showToast],
    );

    const handleLike = useCallback(
        (id: string) => {
            setTriagedCount((prev) => prev + 1);
            showToast("Loved", "like");
            void likeInsight(id);
        },
        [likeInsight, showToast],
    );

    const handleLikeToggle = useCallback(
        (id: string, isCurrentlyLiked: boolean) => {
            if (isCurrentlyLiked) {
                showToast("Unliked", "info");
                void unlikeInsight(id);
            } else {
                handleLike(id);
            }
        },
        [handleLike, unlikeInsight, showToast],
    );

    // Keyboard navigation
    useEffect(() => {
        if (activeTab !== "new" || insights.length === 0) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Early return if user is typing in an input
            const target = e.target as HTMLElement;
            if (
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.isContentEditable
            ) {
                return;
            }

            // Use allInsights for triage deck navigation
            const topInsight =
                activeTab === "new" ? allInsights[0] : insights[0];
            if (!topInsight) return;

            if (e.key === "ArrowLeft") {
                e.preventDefault();
                handleDismiss(topInsight.id);
            } else if (e.key === "ArrowRight") {
                e.preventDefault();
                handleApprove(topInsight.id);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                handleLike(topInsight.id);
            } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setExpandedId((prev) =>
                    prev === topInsight.id ? null : topInsight.id,
                );
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [
        activeTab,
        insights,
        allInsights,
        handleDismiss,
        handleApprove,
        handleLike,
    ]);

    // Reset expansion when the top card changes
    useEffect(() => {
        const topId =
            activeTab === "new" ? allInsights[0]?.id : insights[0]?.id;
        if (topId !== expandedId) {
            setExpandedId(null);
        }
    }, [insights, allInsights, expandedId, activeTab]);

    // Get unique tags (categories) from ALL insights for stable filtering
    const availableTags = useMemo(() => {
        const tags = new Set<string>();
        // Only show tags that actually exist in the current tab's status pool
        const currentTabPool = allInsights.filter((i) => {
            if (activeTab === "approved")
                return i.status === "approved" || i.status === "liked";
            return i.status === activeTab;
        });

        for (const insight of currentTabPool) {
            tags.add(insight.category);
        }
        return Array.from(tags).sort();
    }, [allInsights, activeTab]);

    // Filter ALL insights by status and selected tag, then we will paginate later if needed
    const filteredInsights = useMemo(() => {
        const base = allInsights.filter((i) => {
            if (activeTab === "approved")
                return i.status === "approved" || i.status === "liked";
            return i.status === activeTab;
        });
        if (!selectedTag) return base;
        return base.filter((i) => i.category === selectedTag);
    }, [allInsights, activeTab, selectedTag]);

    // Sort filtered insights by estimated visual weight to minimize row height gaps in grid
    const sortedFilteredInsights = useMemo(() => {
        return [...filteredInsights].sort((a, b) => {
            const getWeight = (i: typeof a) =>
                (i.title?.length || 0) +
                (i.description?.length || 0) * 1.2 +
                (i.affectedFiles?.length || 0) * 20;
            return getWeight(b) - getWeight(a);
        });
    }, [filteredInsights]);

    const totalInSession =
        triagedCount + (activeTab === "new" ? allInsights.length : 0);

    const formatCategory = (cat: string) => {
        return cat.replace("_", " ").toUpperCase();
    };

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
                <div className="mb-4 p-3 bg-app-error/10 border border-app-error/20 rounded-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center gap-2 text-app-error">
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
                        className="text-app-error/60 hover:text-app-error transition-colors"
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
                className="flex items-center gap-4 mb-6 border-b border-app-border/50"
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
                className="flex flex-col gap-3 min-h-[300px]"
                id="warden-tabpanel"
                role="tabpanel"
                aria-labelledby={`warden-tab-${activeTab}`}
                aria-live="polite"
            >
                {!hasApiKey ? (
                    <div className="bg-app-surface border border-app-border rounded-xl shadow-app-sm p-8 flex flex-col items-center justify-center text-center">
                        <p className="text-app-text-muted text-sm">
                            Configure your AI API key in Settings to enable
                            Warden
                        </p>
                    </div>
                ) : isAnalyzing && insights.length === 0 ? (
                    <div className="bg-app-surface border border-app-border rounded-xl shadow-app-sm p-8 flex flex-col items-center justify-center text-center gap-3">
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
                                className="bg-app-surface border border-app-border rounded-xl shadow-app-sm p-4 h-24 flex flex-col justify-center gap-2.5"
                            >
                                <div className="h-4 bg-app-border/40 rounded w-[90%] animate-pulse" />
                                <div className="h-4 bg-app-border/40 rounded w-[60%] animate-pulse" />
                            </div>
                        ))}
                    </div>
                ) : (activeTab === "new"
                      ? allInsights.length
                      : filteredInsights.length) === 0 ? (
                    <div className="bg-app-surface border border-app-border rounded-xl shadow-app-sm p-8 flex flex-col items-center justify-center text-center">
                        <p className="text-app-text-muted text-[13px]">
                            {activeTab === "new" &&
                                "No new insights. Warden will analyze your project on the next commit."}
                            {activeTab === "approved" &&
                                "No approved insights yet. Review new insights to approve them."}
                            {activeTab === "liked" &&
                                "No liked insights yet. Like your favorite approved insights."}
                        </p>
                    </div>
                ) : activeTab === "new" ? (
                    <div className="flex flex-col items-center w-full">
                        {/* Compact Mechanical Progress Bar */}
                        <div className="w-full max-w-[320px] flex gap-1.5 mb-10 h-0.5">
                            {Array.from({ length: totalInSession }).map(
                                (_, idx) => {
                                    const isProcessed = idx < triagedCount;
                                    const isCurrent = idx === triagedCount;
                                    return (
                                        <div
                                            key={idx}
                                            className={`h-full flex-1 transition-all duration-300 ${
                                                isProcessed
                                                    ? "bg-app-accent/20"
                                                    : isCurrent
                                                      ? "bg-app-accent shadow-[0_0_8px_rgba(var(--app-accent),0.5)]"
                                                      : "bg-app-border"
                                            }`}
                                        />
                                    );
                                },
                            )}
                        </div>

                        <div className="relative w-full max-w-[460px]">
                            <AnimatePresence mode="popLayout">
                                {allInsights.slice(0, 3).map((insight, idx) => (
                                    <SwipeableCard
                                        key={insight.id}
                                        insight={insight}
                                        index={idx}
                                        isTop={idx === 0}
                                        isExpanded={expandedId === insight.id}
                                        onToggleExpand={() =>
                                            setExpandedId((prev) =>
                                                prev === insight.id
                                                    ? null
                                                    : insight.id,
                                            )
                                        }
                                        onSwipeLeft={handleDismiss}
                                        onSwipeRight={handleApprove}
                                        onSwipeUp={handleLike}
                                        onLike={() =>
                                            handleLikeToggle(
                                                insight.id,
                                                insight.status === "liked",
                                            )
                                        }
                                    />
                                ))}
                            </AnimatePresence>
                            {/* Empty space placeholder to prevent footer jumping */}
                            <div className="h-[440px] pointer-events-none" />
                        </div>

                        {/* Flat Mechanical Hints */}
                        <div className="flex justify-center gap-8 mt-10">
                            <div className="flex items-center gap-2">
                                <kbd className="flex items-center justify-center w-6 h-6 rounded border border-app-border bg-app-surface-elevated font-mono text-[10px] text-app-text-muted">
                                    ←
                                </kbd>
                                <span className="text-[9px] font-bold text-app-text-muted uppercase tracking-widest">
                                    Ignore
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <kbd className="flex items-center justify-center w-6 h-6 rounded border border-app-border bg-app-surface-elevated font-mono text-[10px] text-app-text-muted">
                                    ↑
                                </kbd>
                                <span className="text-[9px] font-bold text-app-text-muted uppercase tracking-widest">
                                    Love
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <kbd className="flex items-center justify-center w-6 h-6 rounded border border-app-border bg-app-surface-elevated font-mono text-[10px] text-app-text-muted">
                                    ↓
                                </kbd>
                                <span className="text-[9px] font-bold text-app-text-muted uppercase tracking-widest">
                                    Expand
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <kbd className="flex items-center justify-center w-6 h-6 rounded border border-app-border bg-app-surface-elevated font-mono text-[10px] text-app-text-muted">
                                    →
                                </kbd>
                                <span className="text-[9px] font-bold text-app-text-muted uppercase tracking-widest">
                                    Approve
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-6">
                        {/* Tag Filter Bar */}
                        {availableTags.length > 0 && (
                            <div className="flex flex-wrap gap-2 pb-2 border-b border-app-border/30">
                                <button
                                    onClick={() => setSelectedTag(null)}
                                    className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest transition-all ${
                                        selectedTag === null
                                            ? "bg-app-accent text-white shadow-lg shadow-app-accent/20"
                                            : "bg-app-surface-elevated text-app-text-muted border border-app-border hover:border-app-text-muted"
                                    }`}
                                >
                                    All
                                </button>
                                {availableTags.map((tag) => (
                                    <button
                                        key={tag}
                                        onClick={() => setSelectedTag(tag)}
                                        className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest transition-all ${
                                            selectedTag === tag
                                                ? "bg-app-accent text-white shadow-lg shadow-app-accent/20"
                                                : "bg-app-surface-elevated text-app-text-muted border border-app-border hover:border-app-text-muted"
                                        }`}
                                    >
                                        {formatCategory(tag)}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Balanced Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-500 items-stretch">
                            {sortedFilteredInsights.map((insight) => (
                                <div key={insight.id} className="flex">
                                    <InsightCard
                                        insight={insight}
                                        flexHeight={true}
                                        onLike={() =>
                                            handleLikeToggle(
                                                insight.id,
                                                insight.status === "liked",
                                            )
                                        }
                                    />
                                </div>
                            ))}
                        </div>

                        {filteredInsights.length === 0 && selectedTag && (
                            <div className="py-12 flex flex-col items-center justify-center text-center gap-2">
                                <p className="text-app-text-muted text-sm font-medium">
                                    No insights match this filter.
                                </p>
                                <button
                                    onClick={() => setSelectedTag(null)}
                                    className="text-app-accent text-[11px] font-bold uppercase tracking-widest hover:underline"
                                >
                                    Clear Filter
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Pagination Controls - only for archived tabs */}
                {!isLoading && totalPages > 1 && activeTab !== "new" && (
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
                                className="px-3 py-1.5 text-[11px] font-semibold bg-app-surface border border-app-border rounded-lg text-app-text-main hover:bg-app-hover disabled:opacity-30 transition-colors shadow-sm"
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
                                className="px-3 py-1.5 text-[11px] font-semibold bg-app-surface border border-app-border rounded-lg text-app-text-main hover:bg-app-hover disabled:opacity-30 transition-colors shadow-sm"
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
