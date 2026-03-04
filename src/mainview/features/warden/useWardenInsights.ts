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
            const fetchPromises: [
                Promise<unknown>,
                Promise<unknown>,
                Promise<unknown>,
                Promise<unknown>?,
            ] = [
                getWardenInsights(projectId, activeTab),
                getWardenInsightCountsByProject(projectId),
                isAIConfigured(),
            ];

            if (activeTab === "approved") {
                fetchPromises.push(getWardenInsights(projectId, "liked"));
            }

            const [tabInsights, nextCounts, configured, extraInsights] =
                await Promise.all(fetchPromises);

            if (isMounted.current) {
                let mergedInsights = tabInsights as WardenInsight[];
                if (activeTab === "approved" && extraInsights) {
                    const extra = (extraInsights as WardenInsight[]).filter(
                        (ei) => !mergedInsights.some((mi) => mi.id === ei.id),
                    );
                    mergedInsights = [...mergedInsights, ...extra];
                    mergedInsights.sort(
                        (a, b) =>
                            new Date(b.createdAt).getTime() -
                            new Date(a.createdAt).getTime(),
                    );
                }

                setInsights(mergedInsights);
                setHasApiKey(configured as boolean);
                const nextCountsTyped = nextCounts as typeof counts;
                const adjustedCounts = {
                    ...nextCountsTyped,
                    approved: nextCountsTyped.approved + nextCountsTyped.liked,
                };
                setCounts(adjustedCounts);
                setError(null);
            }
        } catch (err) {
            console.error(`[useWardenInsights] Error fetching insights:`, err);
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
            if (isMounted.current) setIsLoading(false);
        };
        load();

        onProjectView(projectId).then((result) => {
            if (!isMounted.current) return;
            if (result.success) {
                setIsAnalyzing(true);
                return;
            }
            if (result.reason === "NO_API_KEY") setHasApiKey(false);
            const message = mapWardenReasonToMessage(result.reason || "");
            if (message) setError(message);
        });

        const unsubscribeInsights = onWardenInsightsUpdated(
            (updatedProjectId) => {
                if (updatedProjectId === projectId) {
                    if (isMounted.current) setIsAnalyzing(false);
                    void fetchAllData();
                }
            },
        );

        const unsubscribeFailure = onWardenAnalysisFailed(
            ({ projectId: fId, reason }) => {
                if (fId === projectId && isMounted.current) {
                    setIsAnalyzing(false);
                    setError(reason);
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
            if (activeTab === "new") {
                setInsights((prev) => prev.filter((i) => i.id !== insightId));
                setCounts((prev) => ({
                    ...prev,
                    new: Math.max(0, prev.new - 1),
                    approved: prev.approved + 1,
                }));
            }
            try {
                await updateWardenInsightStatus(insightId, "approved");
                void fetchAllData();
            } catch (err) {
                setError(
                    err instanceof Error ? err.message : "Failed to approve",
                );
                void fetchAllData();
            }
        },
        [fetchAllData, activeTab],
    );

    const dismissInsight = useCallback(
        async (insightId: string) => {
            setInsights((prev) => prev.filter((i) => i.id !== insightId));
            if (activeTab === "new") {
                setCounts((prev) => ({
                    ...prev,
                    new: Math.max(0, prev.new - 1),
                }));
            }
            try {
                await updateWardenInsightStatus(insightId, "dismissed");
                void fetchAllData();
            } catch (err) {
                setError(
                    err instanceof Error ? err.message : "Failed to dismiss",
                );
                void fetchAllData();
            }
        },
        [fetchAllData, activeTab],
    );

    const likeInsight = useCallback(
        async (insightId: string) => {
            if (activeTab === "new") {
                setInsights((prev) => prev.filter((i) => i.id !== insightId));
                setCounts((prev) => ({
                    ...prev,
                    new: Math.max(0, prev.new - 1),
                    liked: prev.liked + 1,
                    approved: prev.approved + 1,
                }));
            } else if (activeTab === "approved") {
                setInsights((prev) =>
                    prev.map((i) =>
                        i.id === insightId
                            ? { ...i, status: "liked" as WardenInsightStatus }
                            : i,
                    ),
                );
                setCounts((prev) => ({ ...prev, liked: prev.liked + 1 }));
            }
            try {
                await updateWardenInsightStatus(insightId, "liked");
                void fetchAllData();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to like");
                void fetchAllData();
            }
        },
        [fetchAllData, activeTab],
    );

    const unlikeInsight = useCallback(
        async (insightId: string) => {
            if (activeTab === "liked") {
                setInsights((prev) => prev.filter((i) => i.id !== insightId));
                setCounts((prev) => ({
                    ...prev,
                    liked: Math.max(0, prev.liked - 1),
                }));
            } else if (activeTab === "approved") {
                setInsights((prev) =>
                    prev.map((i) =>
                        i.id === insightId
                            ? {
                                  ...i,
                                  status: "approved" as WardenInsightStatus,
                              }
                            : i,
                    ),
                );
                setCounts((prev) => ({
                    ...prev,
                    liked: Math.max(0, prev.liked - 1),
                }));
            }
            try {
                await updateWardenInsightStatus(insightId, "approved");
                void fetchAllData();
            } catch (err) {
                setError(
                    err instanceof Error ? err.message : "Failed to unlike",
                );
                void fetchAllData();
            }
        },
        [fetchAllData, activeTab],
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
                )
                    setHasApiKey(false);
                setError(result.reason || "Analysis failed");
                setIsAnalyzing(false);
            }
            await fetchAllData();
        } catch (err) {
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
        unlikeInsight,
        triggerAnalysis,
    };
}
