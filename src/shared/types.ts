/**
 * Shared domain types for trackmebaby
 * Single source of truth — used by both Bun (backend) and browser (frontend)
 */

import type { SupportedAIProvider } from "./ai-provider.ts";

export interface Worktree {
    path: string; // Absolute path to worktree directory
    branch: string; // Currently checked-out branch
    isMain: boolean; // Is this the main working directory?
    lastActivityAt: string | null; // Derived: mtime of uncommitted files or last commit
    uncommittedCount: number;
    uncommittedFiles: string[];
}

export interface Project {
    id: string;
    path: string;
    name: string;
    lastActivityAt: string | null;
    createdAt: string;
    worktrees: Worktree[]; // Empty array if no worktrees
}

export interface ActivityEvent {
    id: string;
    projectId: string;
    timestamp: string;
    type: "file_create" | "file_modify" | "file_delete";
    filePath: string;
    data?: string; // JSON metadata (e.g., line count delta)
}

export interface GitSnapshot {
    id: string;
    projectId: string;
    timestamp: string;
    branch: string;
    lastCommitHash: string | null;
    lastCommitMessage: string | null;
    lastCommitTimestamp: string | null;
    uncommittedCount: number;
    uncommittedFiles: string[]; // parsed from JSON
    data?: string; // JSON diff stats
}

export interface Settings {
    basePath: string | null;
    aiProvider: SupportedAIProvider;
    aiModel: string;
    pollInterval: number; // ms, default 60000
    watchDebounce: number; // ms, default 500
}

export type AIKeyStorageMode = "secure" | "local_unencrypted" | "none";

export type AIKeyValidationStatus =
    | "idle"
    | "validating"
    | "valid"
    | "invalid"
    | "error"
    | "skipped";

export interface AISettingsStatus {
    provider: SupportedAIProvider;
    model: string;
    hasKey: boolean;
    storageMode: AIKeyStorageMode;
    keychainAvailable: boolean;
    validationStatus: AIKeyValidationStatus;
    message: string | null;
}

export interface SetAIKeyResult {
    keySaved: boolean;
    storageMode: AIKeyStorageMode;
    keychainAvailable: boolean;
    validationStatus: AIKeyValidationStatus;
    message: string;
}

export interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: string;
}

export interface ActivitySummary {
    date: string;
    fileCreates: number;
    fileModifies: number;
    fileDeletes: number;
    total: number;
}

export interface ProjectStats {
    branchCount: number;
    branches: string[];
    totalCommits: number;
    repoAgeFirstCommit: string | null; // ISO date of first commit
    recentCommits: RecentCommit[];
    diffSummary: {
        filesChanged: number;
        insertions: number;
        deletions: number;
    } | null;
}

export interface RecentCommit {
    hash: string;
    message: string;
    timestamp: string;
    author: string;
    insertions: number;
    deletions: number;
}

export interface GitHubIssue {
    number: number;
    title: string;
    state: "open" | "closed";
    url: string;
    createdAt: string;
    closedAt?: string | null;
    user: string;
}

export interface GitHubPR {
    number: number;
    title: string;
    state: "open" | "closed";
    url: string;
    createdAt: string;
    user: string;
    draft: boolean;
    closedAt?: string | null;
    mergedAt?: string | null;
}

export interface GitHubEtag {
    issues: string | null;
    prs: string | null;
}

export interface GitHubData {
    openIssues: number;
    openPRs: number;
    contributorCount: number;
    repoUrl: string | null;
    issues: GitHubIssue[];
    pullRequests: GitHubPR[];
}

export type AIQueryTask = "general" | "project_summary" | "file_summary";

export interface AIQueryOptions {
    task?: AIQueryTask;
    projectId?: string;
    filePath?: string;
    fileType?: string;
    /** When true, the project was explicitly @-mentioned in chat — use wider context */
    isTagged?: boolean;
}

// ─── AI Chat ─────────────────────────────────────────────────────────────────

export interface Conversation {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
}

export interface ChatMessageRecord {
    id: string;
    conversationId: string;
    role: "user" | "assistant";
    content: string;
    taggedProjectIds: string[];
    screenContext: ScreenContext | null;
    timestamp: string;
}

export interface ScreenContext {
    activeTab: string;
    selectedProjectId: string | null;
    selectedProjectName: string | null;
    visibleData: string | null;
}
// ─── Resource Vault ──────────────────────────────────────────────────────────

export type VaultResourceType =
    | "link"
    | "note"
    | "milestone"
    | "idea"
    | "decision"
    | "image"
    | "blocker";

export interface LinkPreview {
    title: string | null;
    description: string | null;
    image: string | null;
    favicon: string | null;
    siteName: string | null;
}

export interface VaultResource {
    id: string;
    projectId: string;
    type: VaultResourceType;
    title: string;
    content: string;
    url: string | null;
    linkPreview: LinkPreview | null;
    isPinned: boolean;
    tags: string[];
    createdAt: string;
    updatedAt: string;
}

// ─── Warden ─────────────────────────────────────────────────────────────────

export type WardenSeverity = "critical" | "warning" | "info";

export type WardenCategory =
    | "security"
    | "tech_debt"
    | "project_health"
    | "suggestion"
    | "testing_gap"
    | "deprecation"
    | "dependency"
    | "refactoring";

export type WardenInsightStatus = "new" | "approved" | "dismissed" | "liked";

export interface WardenInsight {
    id: string;
    projectId: string;
    status: WardenInsightStatus;
    severity: WardenSeverity;
    category: WardenCategory;
    title: string;
    description: string;
    affectedFiles: string[] | null;
    createdAt: string;
    resolvedAt: string | null;
}

// ─── Project Todos ───────────────────────────────────────────────────────────

export type ProjectTodoStatus = "pending" | "completed";
export type ProjectTodoSource = "manual" | "auto";

export interface ProjectTodo {
    id: string;
    projectId: string;
    task: string;
    status: ProjectTodoStatus;
    source: ProjectTodoSource;
    created_at: string;
    completed_at: string | null;
    deleted_at: string | null;
}
