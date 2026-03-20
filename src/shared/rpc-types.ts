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
    AISettingsStatus,
    ChatMessageRecord,
    Conversation,
    GitHubData,
    GitSnapshot,
    LinkPreview,
    Project,
    ProjectStats,
    ProjectTodo,
    ProjectTodoStatus,
    ScreenContext,
    SetAIKeyResult,
    Settings,
    VaultResource,
    VaultResourceType,
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
            // --- AI Chat Conversations ---
            createConversation: {
                params: { title?: string };
                response: Conversation;
            };
            getConversations: {
                params: Record<string, never>;
                response: Conversation[];
            };
            getConversationMessages: {
                params: { conversationId: string };
                response: ChatMessageRecord[];
            };
            deleteConversation: {
                params: { conversationId: string };
                response: { success: boolean };
            };
            renameConversation: {
                params: { conversationId: string; title: string };
                response: { success: boolean };
            };
            sendChatMessage: {
                params: {
                    conversationId: string;
                    content: string;
                    taggedProjectIds?: string[];
                    screenContext?: ScreenContext;
                };
                response: {
                    userMessage: ChatMessageRecord;
                    assistantMessage: ChatMessageRecord;
                };
            };
            getScreenContext: {
                params: {
                    activeTab: string;
                    selectedProjectId?: string;
                };
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
            getAISettingsStatus: {
                params: Record<string, never>;
                response: AISettingsStatus;
            };
            setAIKey: {
                params: {
                    provider: string;
                    apiKey: string;
                    model?: string;
                    validate?: boolean;
                };
                response: SetAIKeyResult;
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
            setWindowTheme: {
                params: { isDark: boolean };
                response: { success: boolean };
            };
            githubStartDeviceFlow: {
                params: Record<string, never>;
                response: {
                    success: boolean;
                    userCode?: string;
                    deviceCode?: string;
                    verificationUri?: string;
                    verificationUriComplete?: string;
                    interval?: number;
                    expiresIn?: number;
                    error?: string;
                };
            };
            githubPollDeviceFlow: {
                params: { deviceCode: string };
                response: {
                    success: boolean;
                    username?: string;
                    error?: string;
                    retryable?: boolean;
                    intervalMs?: number;
                };
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
            getWardenInsightCountsByProject: {
                params: { projectId: string };
                response: { new: number; approved: number; liked: number };
            };
            triggerWardenAnalysis: {
                params: { projectId: string };
                response: {
                    success: boolean;
                    insightCount: number;
                    reason?: string;
                };
            };
            updateWardenInsightStatus: {
                params: { insightId: string; status: WardenInsightStatus };
                response: { success: boolean };
            };
            isAIConfigured: {
                params: Record<string, never>;
                response: boolean;
            };
            onProjectView: {
                params: { projectId: string };
                response: {
                    success: boolean;
                    insightCount: number;
                    reason: string;
                };
            };
            getProjectTodos: {
                params: { projectId: string };
                response: ProjectTodo[];
            };
            addProjectTodo: {
                params: {
                    projectId: string;
                    task: string;
                    source?: "manual" | "auto";
                };
                response: ProjectTodo;
            };
            updateProjectTodoStatus: {
                params: { id: string; status: ProjectTodoStatus };
                response: { success: boolean };
            };
            deleteProjectTodo: {
                params: { id: string };
                response: { success: boolean };
            };
            deleteCompletedProjectTodos: {
                params: { projectId: string };
                response: { success: boolean };
            };
            deleteProject: {
                params: { projectId: string };
                response: { success: boolean };
            };
            readClipboardImage: {
                params: Record<string, never>;
                response: { dataUrl: string | null; error?: string };
            };
            // --- Resource Vault ---
            getVaultResources: {
                params: {
                    projectId: string;
                    type?: VaultResourceType;
                };
                response: VaultResource[];
            };
            addVaultResource: {
                params: {
                    projectId: string;
                    type: VaultResourceType;
                    title: string;
                    content: string;
                    url?: string;
                };
                response: VaultResource;
            };
            updateVaultResource: {
                params: {
                    id: string;
                    title?: string;
                    content?: string;
                    type?: VaultResourceType;
                };
                response: { success: boolean };
            };
            deleteVaultResource: {
                params: { id: string };
                response: { success: boolean };
            };
            toggleVaultResourcePin: {
                params: { id: string };
                response: { success: boolean; isPinned: boolean };
            };
            fetchLinkPreview: {
                params: { url: string };
                response: LinkPreview | null;
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
            wardenAnalysisFailed: {
                projectId: string;
                reason: string;
            };
        };
    }>;
};
