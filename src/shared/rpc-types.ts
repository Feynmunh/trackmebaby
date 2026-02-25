/**
 * RPC type definitions for Electrobun typed RPC
 * Defines the contract between Bun (backend) and webview (frontend)
 */
import type { RPCSchema } from "electrobun/bun";
import type {
    Project,
    ActivityEvent,
    GitSnapshot,
    Settings,
    ProjectStats,
    GitHubData,
} from "./types.ts";

export type TrackmeBabyRPC = {
    bun: RPCSchema<{
        requests: {
            getProjects: {
                params: {};
                response: Project[];
            };
            getProjectActivity: {
                params: { projectId: string; since: string };
                response: ActivityEvent[];
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
                params: { question: string };
                response: string;
            };
            getSettings: {
                params: {};
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
            getPlatform: {
                params: {};
                response: string;
            };
            windowMinimize: {
                params: {};
                response: { success: boolean };
            };
            windowMaximize: {
                params: {};
                response: { success: boolean };
            };
            windowClose: {
                params: {};
                response: { success: boolean };
            };
            windowGetPosition: {
                params: {};
                response: { x: number; y: number };
            };
            windowSetPosition: {
                params: { x: number; y: number };
                response: { success: boolean };
            };
            githubStartAuth: {
                params: {};
                response: { success: boolean; error?: string };
            };
            githubSignOut: {
                params: {};
                response: { success: boolean };
            };
            getGitHubAuthStatus: {
                params: {};
                response: { authenticated: boolean; username?: string };
            };
            getGitHubData: {
                params: { projectId: string };
                response: GitHubData | null;
            };
        };
        messages: {
            log: { msg: string };
        };
    }>;
    webview: RPCSchema<{
        requests: {};
        messages: {
            projectsUpdated: { projects: Project[] };
            activityEvent: { event: ActivityEvent };
            gitStatusChanged: {
                projectId: string;
                snapshot: GitSnapshot;
            };
        };
    }>;
};
