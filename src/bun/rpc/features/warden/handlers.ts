import type { Database } from "bun:sqlite";
import type { WardenInsightStatus } from "../../../../shared/types.ts";
import {
    getWardenInsightCountsByProject,
    getWardenInsights,
    updateWardenInsightStatus,
} from "../../../db/queries/warden.ts";

import { getSavedApiKey } from "../../../services/ai/index.ts";
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

export function createGetWardenInsightCountsByProjectHandler(db: Database) {
    return async ({ projectId }: { projectId: string }) => {
        return getWardenInsightCountsByProject(db, projectId);
    };
}

export function createTriggerWardenAnalysisHandler(
    wardenService: WardenService,
) {
    return async ({ projectId }: { projectId: string }) => {
        return wardenService.triggerAnalysis(projectId, { manual: true });
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
            const success = updateWardenInsightStatus(db, insightId, status);
            return { success };
        } catch (err: unknown) {
            console.error("[RPC] Update insight status failed:", err);
            return { success: false };
        }
    };
}

function createIsAIConfiguredHandler() {
    return async () => {
        const apiKey = await getSavedApiKey();
        return !!apiKey;
    };
}

function createOnProjectViewHandler(wardenService: WardenService) {
    return async ({ projectId }: { projectId: string }) => {
        return wardenService.onProjectView(projectId);
    };
}

export function createWardenHandlers(deps: WardenHandlersDeps) {
    return {
        getWardenInsights: createGetWardenInsightsHandler(deps.db),
        getWardenInsightCountsByProject:
            createGetWardenInsightCountsByProjectHandler(deps.db),
        triggerWardenAnalysis: createTriggerWardenAnalysisHandler(
            deps.wardenService,
        ),
        updateWardenInsightStatus: createUpdateWardenInsightStatusHandler(
            deps.db,
        ),
        isAIConfigured: createIsAIConfiguredHandler(),
        onProjectView: createOnProjectViewHandler(deps.wardenService),
    };
}
