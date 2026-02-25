/**
 * Shared domain types for trackmebaby
 * Single source of truth — used by both Bun (backend) and browser (frontend)
 */

export interface Worktree {
    path: string;              // Absolute path to worktree directory
    branch: string;            // Currently checked-out branch
    isMain: boolean;           // Is this the main working directory?
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
    worktrees: Worktree[];     // Empty array if no worktrees
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
    aiProvider: string;
    aiModel: string;
    pollInterval: number;    // ms, default 60000
    watchDebounce: number;   // ms, default 500
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
    contributors: { name: string; commits: number }[];
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
}

export interface GitHubData {
    openIssues: number;
    openPRs: number;
    repoUrl: string | null;
    issues: GitHubIssue[];
    pullRequests: GitHubPR[];
}
