import { useCallback, useEffect, useRef, useState } from "react";
import type {
    WardenInsight,
    WardenInsightStatus,
} from "../../../shared/types.ts";

import {
    getWardenInsightCountsByProject,
    getWardenInsights,
    isAIConfigured,
    onProjectView,
    onWardenAnalysisFailed,
    onWardenInsightsUpdated,
    triggerWardenAnalysis,
    updateWardenInsightStatus,
} from "../../rpc.ts";

function mapWardenReasonToMessage(reason: string): string | null {
    switch (reason) {
        case "NO_API_KEY":
        case "MISSING_API_KEY":
            return "Configure your AI API key in Settings to enable Warden.";
        case "COOLDOWN":
        case "FIRST_RUN_COOLDOWN":
            return "Warden recently analyzed this project. Try again shortly.";
        case "NO_ACTIVITY_EVER":
        case "NO_NEW_ACTIVITY":
            return "No new activity yet. Make a change or commit, then run Warden.";
        case "ALREADY_RUNNING":
        case "QUEUED":
            return "Warden analysis is already running.";
        default:
            return null;
    }
}

export function useWardenInsights(projectId: string) {
    const [insights, setInsights] = useState<WardenInsight[]>([]);
    const [counts, setCounts] = useState({ new: 0, approved: 0, liked: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [hasApiKey, setHasApiKey] = useState(true);
    const [activeTab, setActiveTab] = useState<"new" | "approved" | "liked">(
        "new",
    );
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 20;

    const isMounted = useRef(false);

    const fetchAllData = useCallback(async () => {
        try {
            // We fetch the insights for the specific tab as requested,
            // and the counts for the badges (more efficient than fetching all insights).
            const [tabInsights, nextCounts, configured] = await Promise.all([
                getWardenInsights(projectId, activeTab),
                getWardenInsightCountsByProject(projectId),
                isAIConfigured(),
            ]);

            if (isMounted.current) {
                setInsights(tabInsights);
                setHasApiKey(configured);
                setCounts(nextCounts);
                setError(null);
            }
        } catch (err) {
            console.error(
                `[useWardenInsights] Error fetching insights for ${projectId}:`,
                err,
            );
            if (isMounted.current) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to fetch insights",
                );
            }
        }
    }, [projectId, activeTab]);

    useEffect(() => {
        setPage(0);
    }, [activeTab]);

    useEffect(() => {
        isMounted.current = true;

        const load = async () => {
            setIsLoading(true);
            await fetchAllData();
            if (isMounted.current) {
                setIsLoading(false);
            }
        };

        load();

        // Trigger automatic analysis if needed on view
        onProjectView(projectId).then((result) => {
            if (!isMounted.current) return;

            if (result.success) {
                setIsAnalyzing(true);
                return;
            }

            if (result.reason === "NO_API_KEY") {
                setHasApiKey(false);
            }

            const message = mapWardenReasonToMessage(result.reason || "");
            if (message) {
                setError(message);
            }
        });

        // Subscribe to push notifications for real-time updates
        const unsubscribeInsights = onWardenInsightsUpdated(
            (updatedProjectId) => {
                if (updatedProjectId === projectId) {
                    if (isMounted.current) {
                        setIsAnalyzing(false);
                    }
                    void fetchAllData();
                }
            },
        );

        const unsubscribeFailure = onWardenAnalysisFailed(
            ({ projectId: failedProjectId, reason }) => {
                if (failedProjectId === projectId) {
                    if (isMounted.current) {
                        setIsAnalyzing(false);
                        setError(reason);
                    }
                }
            },
        );

        return () => {
            isMounted.current = false;
            unsubscribeInsights();
            unsubscribeFailure();
        };
    }, [projectId, fetchAllData]);

    const clearError = useCallback(() => setError(null), []);

    const approveInsight = useCallback(
        async (insightId: string) => {
            // Optimistic UI update: update local state
            setInsights((prev) =>
                prev.map((i) =>
                    i.id === insightId
                        ? { ...i, status: "approved" as WardenInsightStatus }
                        : i,
                ),
            );

            try {
                await updateWardenInsightStatus(insightId, "approved");
                setError(null);
                void fetchAllData();
            } catch (err) {
                console.error(
                    `[useWardenInsights] Failed to approve insight ${insightId}:`,
                    err,
                );
                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to approve insight",
                );
                void fetchAllData();
            }
        },
        [fetchAllData],
    );

    const dismissInsight = useCallback(
        async (insightId: string) => {
            // Optimistic UI update: remove from local array
            setInsights((prev) => prev.filter((i) => i.id !== insightId));

            try {
                await updateWardenInsightStatus(insightId, "dismissed");
                setError(null);
                void fetchAllData();
            } catch (err) {
                console.error(
                    `[useWardenInsights] Failed to dismiss insight ${insightId}:`,
                    err,
                );
                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to dismiss insight",
                );
                void fetchAllData();
            }
        },
        [fetchAllData],
    );

    const likeInsight = useCallback(
        async (insightId: string) => {
            // Optimistic UI update: update local state
            setInsights((prev) =>
                prev.map((i) =>
                    i.id === insightId
                        ? { ...i, status: "liked" as WardenInsightStatus }
                        : i,
                ),
            );

            try {
                await updateWardenInsightStatus(insightId, "liked");
                setError(null);
                void fetchAllData();
            } catch (err) {
                console.error(
                    `[useWardenInsights] Failed to like insight ${insightId}:`,
                    err,
                );
                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to like insight",
                );
                void fetchAllData();
            }
        },
        [fetchAllData],
    );

    const triggerAnalysis = useCallback(async () => {
        setIsAnalyzing(true);
        setError(null);
        try {
            const result = await triggerWardenAnalysis(projectId);
            if (!result.success && isMounted.current) {
                if (
                    result.reason === "NO_API_KEY" ||
                    result.reason === "MISSING_API_KEY"
                ) {
                    setHasApiKey(false);
                }

                const message = mapWardenReasonToMessage(result.reason || "");
                setError(message ?? (result.reason || "Analysis failed"));
                // Only stop spinner on failure — on success the push message will stop it
                setIsAnalyzing(false);
            }
            await fetchAllData();
        } catch (err) {
            console.error(
                `[useWardenInsights] Failed to trigger analysis for ${projectId}:`,
                err,
            );
            if (isMounted.current) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to trigger analysis",
                );
                setIsAnalyzing(false);
            }
        }
    }, [projectId, fetchAllData]);

    const totalPages = Math.ceil(insights.length / PAGE_SIZE);
    const displayedInsights = insights.slice(
        page * PAGE_SIZE,
        (page + 1) * PAGE_SIZE,
    );

    return {
        insights: displayedInsights,
        allInsights: insights,
        page,
        setPage,
        totalPages,
        counts,
        isLoading,
        isAnalyzing,
        hasApiKey,
        error,
        clearError,
        activeTab,
        setActiveTab,
        approveInsight,
        dismissInsight,
        likeInsight,
        triggerAnalysis,
    };
}
