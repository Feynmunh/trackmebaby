import { useCallback, useEffect, useState } from "react";
import type {
    WardenInsight,
    WardenInsightStatus,
} from "../../../shared/types.ts";

import {
    getWardenInsights,
    onWardenInsightsUpdated,
    triggerWardenAnalysis,
    updateWardenInsightStatus,
} from "../../rpc.ts";

export function useWardenInsights(projectId: string) {
    const [insights, setInsights] = useState<WardenInsight[]>([]);
    const [counts, setCounts] = useState({ new: 0, approved: 0, liked: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [activeTab, setActiveTab] = useState<"new" | "approved" | "liked">(
        "new",
    );

    const fetchAllData = useCallback(async () => {
        try {
            // We fetch the insights for the specific tab as requested,
            // and all insights to calculate counts for the badges.
            const [tabInsights, allInsights] = await Promise.all([
                getWardenInsights(projectId, activeTab),
                getWardenInsights(projectId),
            ]);

            setInsights(tabInsights);
            setCounts({
                new: allInsights.filter((i) => i.status === "new").length,
                approved: allInsights.filter((i) => i.status === "approved")
                    .length,
                liked: allInsights.filter((i) => i.status === "liked").length,
            });
        } catch (err) {
            console.error(
                `[useWardenInsights] Error fetching insights for ${projectId}:`,
                err,
            );
        }
    }, [projectId, activeTab]);

    useEffect(() => {
        let isMounted = true;

        const load = async () => {
            setIsLoading(true);
            await fetchAllData();
            if (isMounted) {
                setIsLoading(false);
            }
        };

        load();

        // Subscribe to push notifications for real-time updates
        const unsubscribe = onWardenInsightsUpdated((updatedProjectId) => {
            if (updatedProjectId === projectId) {
                void fetchAllData();
            }
        });

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, [projectId, fetchAllData]);

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
                void fetchAllData();
            } catch (err) {
                console.error(
                    `[useWardenInsights] Failed to approve insight ${insightId}:`,
                    err,
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
                void fetchAllData();
            } catch (err) {
                console.error(
                    `[useWardenInsights] Failed to dismiss insight ${insightId}:`,
                    err,
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
                void fetchAllData();
            } catch (err) {
                console.error(
                    `[useWardenInsights] Failed to like insight ${insightId}:`,
                    err,
                );
                void fetchAllData();
            }
        },
        [fetchAllData],
    );

    const triggerAnalysis = useCallback(async () => {
        setIsAnalyzing(true);
        try {
            await triggerWardenAnalysis(projectId);
            await fetchAllData();
        } catch (err) {
            console.error(
                `[useWardenInsights] Failed to trigger analysis for ${projectId}:`,
                err,
            );
        } finally {
            setIsAnalyzing(false);
        }
    }, [projectId, fetchAllData]);

    return {
        insights,
        counts,
        isLoading,
        isAnalyzing,
        activeTab,
        setActiveTab,
        approveInsight,
        dismissInsight,
        likeInsight,
        triggerAnalysis,
    };
}
