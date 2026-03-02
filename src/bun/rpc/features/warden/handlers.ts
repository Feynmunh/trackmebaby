import type { Database } from "bun:sqlite";
import type { WardenInsightStatus } from "../../../../shared/types.ts";
import {
    getWardenInsight,
    getWardenInsights,
    updateWardenInsightStatus,
} from "../../../db/queries.ts";
import type { WardenService } from "../../../services/warden.ts";

export interface WardenHandlersDeps {
    db: Database;
    wardenService: WardenService;
}

export function createGetWardenInsightsHandler(db: Database) {
    return async ({
        projectId,
        status,
    }: {
        projectId: string;
        status?: WardenInsightStatus;
    }) => {
        return getWardenInsights(db, projectId, status);
    };
}

export function createTriggerWardenAnalysisHandler(
    wardenService: WardenService,
) {
    return async ({ projectId }: { projectId: string }) => {
        try {
            const insights = await wardenService.analyzeProject(
                projectId,
                "",
                true,
            ); // manual=true
            return { success: true, insightCount: insights.length };
        } catch (err: unknown) {
            console.error("[RPC] Warden analysis failed:", err);
            return { success: false, insightCount: 0 };
        }
    };
}

export function createUpdateWardenInsightStatusHandler(db: Database) {
    return async ({
        insightId,
        status,
    }: {
        insightId: string;
        status: WardenInsightStatus;
    }) => {
        try {
            // Validation: can ONLY set to 'liked' if currently 'approved'
            if (status === "liked") {
                const current = getWardenInsight(db, insightId);
                if (!current || current.status !== "approved") {
                    console.warn(
                        "[RPC] Cannot like non-approved insight:",
                        insightId,
                    );
                    return { success: false };
                }
            }

            const success = updateWardenInsightStatus(db, insightId, status);
            return { success };
        } catch (err: unknown) {
            console.error("[RPC] Update insight status failed:", err);
            return { success: false };
        }
    };
}

export function createWardenHandlers(deps: WardenHandlersDeps) {
    return {
        getWardenInsights: createGetWardenInsightsHandler(deps.db),
        triggerWardenAnalysis: createTriggerWardenAnalysisHandler(
            deps.wardenService,
        ),
        updateWardenInsightStatus: createUpdateWardenInsightStatusHandler(
            deps.db,
        ),
    };
}
