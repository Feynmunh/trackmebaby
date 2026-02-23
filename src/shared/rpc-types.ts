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
