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
    AIQueryOptions,
    ChatMessageRecord,
    Conversation,
    GitHubData,
    GitSnapshot,
    LinkPreview,
    Project,
    ProjectStats,
    ScreenContext,
    Settings,
    VaultResource,
    VaultResourceType,
    WardenInsight,
    WardenInsightStatus,
} from "../shared/types.ts";

// Initialize RPC
const rpc = Electroview.defineRPC<TrackmeBabyRPC>({
    maxRequestTime: 60000,
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
            wardenInsightsUpdated: ({ projectId, insights }) => {
                for (const cb of rpcEventHandlers.wardenInsightsUpdated) {
                    cb(projectId, insights);
                }
            },
            wardenAnalysisFailed: ({ projectId, reason }) => {
                for (const cb of rpcEventHandlers.wardenAnalysisFailed) {
                    cb({ projectId, reason });
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
    wardenInsightsUpdated: [] as Array<
        (projectId: string, insights: WardenInsight[]) => void
    >,
    wardenAnalysisFailed: [] as Array<
        (payload: { projectId: string; reason: string }) => void
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

export async function queryAI(
    question: string,
    options?: AIQueryOptions,
): Promise<string> {
    return requestApi.queryAI({ question, options });
}

// --- AI Chat Conversations ---

export async function createConversation(
    title?: string,
): Promise<Conversation> {
    return requestApi.createConversation({ title });
}

export async function getConversations(): Promise<Conversation[]> {
    return requestApi.getConversations({});
}

export async function getConversationMessages(
    conversationId: string,
): Promise<ChatMessageRecord[]> {
    return requestApi.getConversationMessages({ conversationId });
}

export async function deleteConversation(
    conversationId: string,
): Promise<{ success: boolean }> {
    return requestApi.deleteConversation({ conversationId });
}

export async function renameConversation(
    conversationId: string,
    title: string,
): Promise<{ success: boolean }> {
    return requestApi.renameConversation({ conversationId, title });
}

export async function sendChatMessage(params: {
    conversationId: string;
    content: string;
    taggedProjectIds?: string[];
    screenContext?: ScreenContext;
}): Promise<{
    userMessage: ChatMessageRecord;
    assistantMessage: ChatMessageRecord;
}> {
    return requestApi.sendChatMessage(params);
}

export async function getScreenContext(
    activeTab: string,
    selectedProjectId?: string,
): Promise<string> {
    return requestApi.getScreenContext({ activeTab, selectedProjectId });
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

export async function getGitDiff(
    projectId: string,
): Promise<{ diff: string; error?: string }> {
    return requestApi.getGitDiff({ projectId });
}

// --- Warden (AI Activity Guard) ---

export async function getWardenInsights(
    projectId: string,
    status?: WardenInsightStatus,
): Promise<WardenInsight[]> {
    return requestApi.getWardenInsights({ projectId, status });
}

export async function getWardenInsightCountsByProject(
    projectId: string,
): Promise<{ new: number; approved: number; liked: number }> {
    return requestApi.getWardenInsightCountsByProject({ projectId });
}

export async function triggerWardenAnalysis(
    projectId: string,
): Promise<{ success: boolean; insightCount: number; reason?: string }> {
    return requestApi.triggerWardenAnalysis({ projectId });
}

export async function isAIConfigured(): Promise<boolean> {
    return requestApi.isAIConfigured({});
}

export async function onProjectView(
    projectId: string,
): Promise<{ success: boolean; insightCount: number; reason: string }> {
    return requestApi.onProjectView({ projectId });
}

export async function updateWardenInsightStatus(
    insightId: string,
    status: WardenInsightStatus,
): Promise<{ success: boolean }> {
    return requestApi.updateWardenInsightStatus({ insightId, status });
}

export async function deleteProject(
    projectId: string,
): Promise<{ success: boolean }> {
    return requestApi.deleteProject({ projectId });
}

export async function readClipboardImage(): Promise<{
    dataUrl: string | null;
    error?: string;
}> {
    return requestApi.readClipboardImage({});
}

// --- Resource Vault ---

export async function getVaultResources(
    projectId: string,
    type?: VaultResourceType,
): Promise<VaultResource[]> {
    return requestApi.getVaultResources({ projectId, type });
}

export async function addVaultResource(params: {
    projectId: string;
    type: VaultResourceType;
    title: string;
    content: string;
    url?: string;
}): Promise<VaultResource> {
    return requestApi.addVaultResource(params);
}

export async function updateVaultResource(params: {
    id: string;
    title?: string;
    content?: string;
    type?: VaultResourceType;
}): Promise<{ success: boolean }> {
    return requestApi.updateVaultResource(params);
}

export async function deleteVaultResource(
    id: string,
): Promise<{ success: boolean }> {
    return requestApi.deleteVaultResource({ id });
}

export async function toggleVaultResourcePin(
    id: string,
): Promise<{ success: boolean; isPinned: boolean }> {
    return requestApi.toggleVaultResourcePin({ id });
}

export async function fetchLinkPreview(
    url: string,
): Promise<LinkPreview | null> {
    return requestApi.fetchLinkPreview({ url });
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

export function onWardenInsightsUpdated(
    cb: (projectId: string, insights: WardenInsight[]) => void,
): () => void {
    rpcEventHandlers.wardenInsightsUpdated.push(cb);
    return () => {
        const idx = rpcEventHandlers.wardenInsightsUpdated.indexOf(cb);
        if (idx >= 0) rpcEventHandlers.wardenInsightsUpdated.splice(idx, 1);
    };
}

export function onWardenAnalysisFailed(
    cb: (payload: { projectId: string; reason: string }) => void,
): () => void {
    rpcEventHandlers.wardenAnalysisFailed.push(cb);
    return () => {
        const idx = rpcEventHandlers.wardenAnalysisFailed.indexOf(cb);
        if (idx >= 0) rpcEventHandlers.wardenAnalysisFailed.splice(idx, 1);
    };
}
