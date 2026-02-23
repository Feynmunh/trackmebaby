/**
 * Frontend RPC hook — connects to Electrobun's typed RPC from the browser side
 * Provides a simple API for React components to call backend functions
 */
import { Electroview } from "electrobun/view";
import type { TrackmeBabyRPC } from "../../shared/rpc-types.ts";
import type {
    Project,
    ActivityEvent,
    GitSnapshot,
    Settings,
} from "../../shared/types.ts";

// Initialize RPC
const rpc = Electroview.defineRPC<TrackmeBabyRPC>({
    handlers: {
        requests: {},
        messages: {
            projectsUpdated: ({ projects }) => {
                rpcEventHandlers.projectsUpdated.forEach((cb) => cb(projects));
            },
            activityEvent: ({ event }) => {
                rpcEventHandlers.activityEvent.forEach((cb) => cb(event));
            },
            gitStatusChanged: ({ projectId, snapshot }) => {
                rpcEventHandlers.gitStatusChanged.forEach((cb) =>
                    cb(projectId, snapshot)
                );
            },
        },
    },
});

const electroview = new Electroview({ rpc });

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
    return electroview.rpc.request.getProjects({});
}

export async function getProjectActivity(
    projectId: string,
    since: string
): Promise<ActivityEvent[]> {
    return electroview.rpc.request.getProjectActivity({ projectId, since });
}

export async function getGitStatus(
    projectId: string
): Promise<GitSnapshot | null> {
    return electroview.rpc.request.getGitStatus({ projectId });
}

export async function queryAI(question: string): Promise<string> {
    return electroview.rpc.request.queryAI({ question });
}

export async function getSettings(): Promise<Settings> {
    return electroview.rpc.request.getSettings({});
}

export async function updateSettings(
    settings: Partial<Settings>
): Promise<{ success: boolean }> {
    return electroview.rpc.request.updateSettings({ settings });
}

export async function scanProjects(basePath: string): Promise<Project[]> {
    return electroview.rpc.request.scanProjects({ basePath });
}

// --- Push Message Subscriptions ---

export function onProjectsUpdated(
    cb: (projects: Project[]) => void
): () => void {
    rpcEventHandlers.projectsUpdated.push(cb);
    return () => {
        const idx = rpcEventHandlers.projectsUpdated.indexOf(cb);
        if (idx >= 0) rpcEventHandlers.projectsUpdated.splice(idx, 1);
    };
}

export function onActivityEvent(
    cb: (event: ActivityEvent) => void
): () => void {
    rpcEventHandlers.activityEvent.push(cb);
    return () => {
        const idx = rpcEventHandlers.activityEvent.indexOf(cb);
        if (idx >= 0) rpcEventHandlers.activityEvent.splice(idx, 1);
    };
}

export function onGitStatusChanged(
    cb: (projectId: string, snapshot: GitSnapshot) => void
): () => void {
    rpcEventHandlers.gitStatusChanged.push(cb);
    return () => {
        const idx = rpcEventHandlers.gitStatusChanged.indexOf(cb);
        if (idx >= 0) rpcEventHandlers.gitStatusChanged.splice(idx, 1);
    };
}
