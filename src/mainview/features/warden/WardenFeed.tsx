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
                    <h3 className="text-[10px] font-bold text-mac-secondary uppercase tracking-[0.2em] flex items-center gap-1.5">
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
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-mac-surface/40 border border-mac-border rounded-lg text-mac-text hover:bg-mac-hover disabled:opacity-50 transition-colors shadow-sm"
                >
                    {isAnalyzing ? (
                        <div className="flex gap-1 items-center justify-center w-12">
                            <span
                                className="w-1 h-1 rounded-full bg-mac-text/70 animate-bounce"
                                style={{ animationDelay: "0ms" }}
                            />
                            <span
                                className="w-1 h-1 rounded-full bg-mac-text/70 animate-bounce"
                                style={{ animationDelay: "150ms" }}
                            />
                            <span
                                className="w-1 h-1 rounded-full bg-mac-text/70 animate-bounce"
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

            {/* Tab Bar */}
            <div className="flex items-center gap-4 mb-4 border-b border-mac-border/50">
                {TABS.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const count = counts[tab.id as keyof typeof counts];
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`pb-2 px-1 text-[13px] font-medium transition-colors ${
                                isActive
                                    ? "text-mac-text border-b-2 border-mac-accent"
                                    : "text-mac-secondary hover:text-mac-text"
                            }`}
                        >
                            {tab.label} ({count})
                        </button>
                    );
                })}
            </div>

            {/* Content Area */}
            <div className="flex flex-col gap-3">
                {!hasApiKey ? (
                    <div className="bg-mac-surface/40 border border-mac-border rounded-xl shadow-mac-sm p-8 flex flex-col items-center justify-center text-center">
                        <p className="text-mac-secondary text-sm">
                            Configure your AI API key in Settings to enable
                            Warden
                        </p>
                    </div>
                ) : isAnalyzing && insights.length === 0 ? (
                    <div className="bg-mac-surface/40 border border-mac-border rounded-xl shadow-mac-sm p-8 flex flex-col items-center justify-center text-center gap-3">
                        <div className="flex gap-1.5">
                            <span
                                className="w-1.5 h-1.5 rounded-full bg-mac-secondary/50 animate-bounce"
                                style={{ animationDelay: "0ms" }}
                            />
                            <span
                                className="w-1.5 h-1.5 rounded-full bg-mac-secondary/50 animate-bounce"
                                style={{ animationDelay: "150ms" }}
                            />
                            <span
                                className="w-1.5 h-1.5 rounded-full bg-mac-secondary/50 animate-bounce"
                                style={{ animationDelay: "300ms" }}
                            />
                        </div>
                        <p className="text-mac-secondary text-sm">
                            Warden is analyzing your project...
                        </p>
                    </div>
                ) : isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="bg-mac-surface/40 border border-mac-border rounded-xl shadow-mac-sm p-4 h-24 flex flex-col justify-center gap-2.5"
                            >
                                <div className="h-4 bg-mac-border/40 rounded w-[90%] animate-pulse" />
                                <div className="h-4 bg-mac-border/40 rounded w-[60%] animate-pulse" />
                            </div>
                        ))}
                    </div>
                ) : insights.length === 0 ? (
                    <div className="bg-mac-surface/40 border border-mac-border rounded-xl shadow-mac-sm p-8 flex flex-col items-center justify-center text-center">
                        <p className="text-mac-secondary text-[13px]">
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
            </div>
        </div>
    );
}
