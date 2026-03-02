/**
 * RPC type definitions for Electrobun typed RPC
 * Defines the contract between Bun (backend) and webview (frontend)
 */
import type { RPCSchema } from "electrobun/bun";
import type { LogEntry } from "./logger.ts";
import type {
    ActivityEvent,
    ActivitySummary,
    AIQueryOptions,
    GitHubData,
    GitSnapshot,
    Project,
    ProjectStats,
    Settings,
    WardenInsight,
    WardenInsightStatus,
} from "./types.ts";

export type TrackmeBabyRPC = {
    bun: RPCSchema<{
        requests: {
            getProjects: {
                params: Record<string, never>;
                response: Project[];
            };
            getProjectActivity: {
                params: { projectId: string; since: string };
                response: ActivityEvent[];
            };
            getProjectActivitySummary: {
                params: { projectId: string; since: string; until: string };
                response: ActivitySummary[];
            };
            getGitStatus: {
                params: { projectId: string };
                response: GitSnapshot | null;
            };
            getProjectStats: {
                params: { projectId: string };
                response: ProjectStats | null;
            };
            queryAI: {
                params: { question: string; options?: AIQueryOptions };
                response: string;
            };
            getSettings: {
                params: Record<string, never>;
                response: Settings;
            };
            updateSettings: {
                params: { settings: Partial<Settings> };
                response: { success: boolean };
            };
            scanProjects: {
                params: { basePath: string };
                response: Project[];
            };
            selectFolder: {
                params: { defaultPath?: string };
                response: string | null;
            };
            getPlatform: {
                params: Record<string, never>;
                response: string;
            };
            windowMinimize: {
                params: Record<string, never>;
                response: { success: boolean };
            };
            windowMaximize: {
                params: Record<string, never>;
                response: { success: boolean };
            };
            windowClose: {
                params: Record<string, never>;
                response: { success: boolean };
            };
            windowGetPosition: {
                params: Record<string, never>;
                response: { x: number; y: number };
            };
            windowSetPosition: {
                params: { x: number; y: number };
                response: { success: boolean };
            };
            githubStartAuth: {
                params: Record<string, never>;
                response: { success: boolean; error?: string };
            };
            githubSignOut: {
                params: Record<string, never>;
                response: { success: boolean };
            };
            getGitHubAuthStatus: {
                params: Record<string, never>;
                response: { authenticated: boolean; username?: string };
            };
            getGitHubData: {
                params: { projectId: string };
                response: GitHubData | null;
            };
            openExternalUrl: {
                params: { url: string };
                response: { success: boolean; error?: string };
            };
            getGitDiff: {
                params: { projectId: string };
                response: { diff: string; error?: string };
            };
            getWardenInsights: {
                params: { projectId: string; status?: WardenInsightStatus };
                response: WardenInsight[];
            };
            triggerWardenAnalysis: {
                params: { projectId: string };
                response: { success: boolean; insightCount: number };
            };
            updateWardenInsightStatus: {
                params: { insightId: string; status: WardenInsightStatus };
                response: { success: boolean };
            };
        };
        messages: {
            log: { entry: LogEntry };
        };
    }>;
    webview: RPCSchema<{
        requests: Record<string, never>;
        messages: {
            projectsUpdated: { projects: Project[] };
            activityEvent: { event: ActivityEvent };
            gitStatusChanged: {
                projectId: string;
                snapshot: GitSnapshot;
            };
            wardenInsightsUpdated: {
                projectId: string;
                insights: WardenInsight[];
            };
        };
    }>;
};
