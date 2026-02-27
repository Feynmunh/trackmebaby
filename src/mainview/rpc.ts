/**
 * Frontend RPC hook — connects to Electrobun's typed RPC from the browser side
 * Provides a simple API for React components to call backend functions
 */
import { Electroview } from "electrobun/view";
import { emitLog, type LogEntry, setLogSink } from "../shared/logger.ts";
import type { TrackmeBabyRPC } from "../shared/rpc-types.ts";
import type {
    ActivityEvent,
    ActivitySummary,
    GitHubData,
    GitSnapshot,
    Project,
    ProjectStats,
    Settings,
} from "../shared/types.ts";

// Initialize RPC
const rpc = Electroview.defineRPC<TrackmeBabyRPC>({
    maxRequestTime: 15000,
    handlers: {
        requests: {},
        messages: {
            projectsUpdated: ({ projects }: { projects: Project[] }) => {
                for (const cb of rpcEventHandlers.projectsUpdated) {
                    cb(projects);
                }
            },
            activityEvent: ({ event }: { event: ActivityEvent }) => {
                for (const cb of rpcEventHandlers.activityEvent) {
                    cb(event);
                }
            },
            gitStatusChanged: ({
                projectId,
                snapshot,
            }: {
                projectId: string;
                snapshot: GitSnapshot;
            }) => {
                for (const cb of rpcEventHandlers.gitStatusChanged) {
                    cb(projectId, snapshot);
                }
            },
        },
    },
});

const electroview = new Electroview({ rpc });

setLogSink((entry: LogEntry) => {
    if (rpc.send?.log) {
        rpc.send.log({ entry });
    } else {
        emitLog(entry);
    }
});

const requestApi = (() => {
    const api = electroview.rpc?.request;
    if (!api) {
        throw new Error("Electroview RPC request API is unavailable");
    }
    return api;
})();

// Event handlers registry for push messages
const rpcEventHandlers = {
    projectsUpdated: [] as Array<(projects: Project[]) => void>,
    activityEvent: [] as Array<(event: ActivityEvent) => void>,
    gitStatusChanged: [] as Array<
        (projectId: string, snapshot: GitSnapshot) => void
    >,
};

// --- Public API ---

export async function getProjects(): Promise<Project[]> {
    return requestApi.getProjects({});
}

export async function getProjectActivity(
    projectId: string,
    since: string,
): Promise<ActivityEvent[]> {
    return requestApi.getProjectActivity({ projectId, since });
}

export async function getProjectActivitySummary(
    projectId: string,
    since: string,
    until: string,
): Promise<ActivitySummary[]> {
    return requestApi.getProjectActivitySummary({ projectId, since, until });
}

export async function getGitStatus(
    projectId: string,
): Promise<GitSnapshot | null> {
    return requestApi.getGitStatus({ projectId });
}

export async function getProjectStats(
    projectId: string,
): Promise<ProjectStats | null> {
    return requestApi.getProjectStats({ projectId });
}

export async function queryAI(question: string): Promise<string> {
    return requestApi.queryAI({ question });
}

export async function getSettings(): Promise<Settings> {
    return requestApi.getSettings({});
}

export async function updateSettings(
    settings: Partial<Settings>,
): Promise<{ success: boolean }> {
    return requestApi.updateSettings({ settings });
}

export async function scanProjects(basePath: string): Promise<Project[]> {
    return requestApi.scanProjects({ basePath });
}

export async function selectFolder(
    defaultPath?: string,
): Promise<string | null> {
    return requestApi.selectFolder({ defaultPath });
}

export async function getPlatform(): Promise<string> {
    return requestApi.getPlatform({});
}

export async function windowMinimize(): Promise<{ success: boolean }> {
    return requestApi.windowMinimize({});
}

export async function windowMaximize(): Promise<{ success: boolean }> {
    return requestApi.windowMaximize({});
}

export async function windowClose(): Promise<{ success: boolean }> {
    return requestApi.windowClose({});
}

export async function windowGetPosition(): Promise<{ x: number; y: number }> {
    return requestApi.windowGetPosition({});
}

export async function windowSetPosition(
    x: number,
    y: number,
): Promise<{ success: boolean }> {
    return requestApi.windowSetPosition({ x, y });
}

// --- GitHub Integration ---

export async function githubStartAuth(): Promise<{
    success: boolean;
    error?: string;
}> {
    return requestApi.githubStartAuth({});
}

export async function githubSignOut(): Promise<{ success: boolean }> {
    return requestApi.githubSignOut({});
}

export async function getGitHubAuthStatus(): Promise<{
    authenticated: boolean;
    username?: string;
}> {
    return requestApi.getGitHubAuthStatus({});
}

export async function getGitHubData(
    projectId: string,
): Promise<GitHubData | null> {
    return requestApi.getGitHubData({ projectId });
}

export async function openExternalUrl(
    url: string,
): Promise<{ success: boolean; error?: string }> {
    return requestApi.openExternalUrl({ url });
}

// --- Push Message Subscriptions ---

export function onProjectsUpdated(
    cb: (projects: Project[]) => void,
): () => void {
    rpcEventHandlers.projectsUpdated.push(cb);
    return () => {
        const idx = rpcEventHandlers.projectsUpdated.indexOf(cb);
        if (idx >= 0) rpcEventHandlers.projectsUpdated.splice(idx, 1);
    };
}

export function onActivityEvent(
    cb: (event: ActivityEvent) => void,
): () => void {
    rpcEventHandlers.activityEvent.push(cb);
    return () => {
        const idx = rpcEventHandlers.activityEvent.indexOf(cb);
        if (idx >= 0) rpcEventHandlers.activityEvent.splice(idx, 1);
    };
}

export function onGitStatusChanged(
    cb: (projectId: string, snapshot: GitSnapshot) => void,
): () => void {
    rpcEventHandlers.gitStatusChanged.push(cb);
    return () => {
        const idx = rpcEventHandlers.gitStatusChanged.indexOf(cb);
        if (idx >= 0) rpcEventHandlers.gitStatusChanged.splice(idx, 1);
    };
}
