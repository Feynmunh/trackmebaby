import type { Database } from "bun:sqlite";
import { readFile, realpath, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";
import type { AIQueryOptions } from "../../../shared/types.ts";
import {
    getAllRecentEvents,
    getLatestGitSnapshot,
    getProjectById,
    getProjects,
} from "../../db/queries.ts";
import { runGit } from "../git-command.ts";

const MAX_CONTEXT_CHARS = 14000;
const MAX_DIFF_CHARS = 6000;
const MAX_FILE_CHARS = 12000;
const MAX_FILE_BYTES = 200_000;
const DIFF_CONTEXT_LINES = 60;
const MAX_CALL_SITE_CHARS = 2200;
const MAX_CALL_SITE_FILES = 2;
const CALL_SITE_CONTEXT_LINES = 3;

export async function assembleContext(
    db: Database,
    question: string,
    options?: AIQueryOptions,
): Promise<string> {
    const task = options?.task ?? "general";
    if (task === "file_summary") {
        return assembleFileContext(db, options);
    }
    return assembleProjectContext(db, question, options);
}

async function assembleProjectContext(
    db: Database,
    question: string,
    options?: AIQueryOptions,
): Promise<string> {
    const timeRange = parseTimeRange(question);
    const since = timeRange.since;
    let projects = getProjects(db);
    if (options?.projectId) {
        const project = getProjectById(db, options.projectId);
        if (!project) {
            return `No project was found with the specified ID (${options.projectId}).`;
        }
        projects = [project];
    }

    if (projects.length === 0) {
        return "No projects are currently being tracked. The user has not set up any projects yet.";
    }

    const sections: string[] = [];
    sections.push(`[ACTIVITY_REPORT: ${timeRange.label}]`);
    sections.push(`Total tracked projects: ${projects.length}\n`);

    const allEvents = getAllRecentEvents(db, since);
    const eventsByProject = new Map<string, typeof allEvents>();
    for (const event of allEvents) {
        const existing = eventsByProject.get(event.projectId);
        if (existing) {
            existing.push(event);
        } else {
            eventsByProject.set(event.projectId, [event]);
        }
    }

    for (const currentProject of projects) {
        const events = eventsByProject.get(currentProject.id) ?? [];
        const gitSnapshot = getLatestGitSnapshot(db, currentProject.id);

        if (events.length === 0 && !gitSnapshot) continue;

        const projectSection: string[] = [];

        projectSection.push(`[PROJECT_METADATA]`);
        projectSection.push(`Name: ${currentProject.name}`);
        projectSection.push(`Path: ${currentProject.path}`);

        if (gitSnapshot) {
            projectSection.push(`[GIT_STATUS]`);
            projectSection.push(`Branch: ${gitSnapshot.branch}`);
            if (gitSnapshot.lastCommitMessage) {
                projectSection.push(
                    `Last commit: "${gitSnapshot.lastCommitMessage}"`,
                );
            }
            if (gitSnapshot.uncommittedCount > 0) {
                projectSection.push(
                    `Uncommitted changes: ${gitSnapshot.uncommittedCount} files`,
                );
                const files = gitSnapshot.uncommittedFiles.slice(0, 5);
                for (const f of files) {
                    projectSection.push(`  - ${f}`);
                }
                if (gitSnapshot.uncommittedFiles.length > 5) {
                    projectSection.push(
                        `  ... and ${gitSnapshot.uncommittedFiles.length - 5} more`,
                    );
                }
            }
        }

        if (events.length > 0) {
            projectSection.push(`[FILE_ACTIVITY_SUMMARY]`);
            const creates = events.filter(
                (e) => e.type === "file_create",
            ).length;
            const modifies = events.filter(
                (e) => e.type === "file_modify",
            ).length;
            const deletes = events.filter(
                (e) => e.type === "file_delete",
            ).length;

            projectSection.push(
                `${creates} created, ${modifies} modified, ${deletes} deleted`,
            );

            const recentFiles = [
                ...new Set(events.map((e) => e.filePath)),
            ].slice(0, 8);
            projectSection.push(`Recent modified paths:`);
            for (const f of recentFiles) {
                projectSection.push(`  - ${f}`);
            }
        }

        sections.push(projectSection.join("\n"));

        if (options?.task === "project_summary") {
            const diff = await loadProjectDiff(currentProject.path);
            if (diff) {
                sections.push(`[CODE_CHANGES: UNCOMMITTED_DIFF]`);
                sections.push(diff);
            }
        }

        if (sections.join("\n\n").length > MAX_CONTEXT_CHARS) {
            sections.push("(Activity truncated to fit context window)");
            break;
        }
    }

    const context = sections.join("\n\n");
    if (context.length > MAX_CONTEXT_CHARS) {
        return `${context.substring(0, MAX_CONTEXT_CHARS)}\n\n(truncated)`;
    }

    return context;
}

async function assembleFileContext(
    db: Database,
    options?: AIQueryOptions,
): Promise<string> {
    const projectId = options?.projectId;
    const filePath = options?.filePath;
    if (!projectId || !filePath) {
        return "No file context available.";
    }

    const project = getProjectById(db, projectId);
    if (!project) {
        return "Project not found for file context.";
    }

    const fileType = options?.fileType?.toLowerCase();
    const isDeleted =
        fileType === "delete" ||
        fileType === "deleted" ||
        fileType === "remove" ||
        fileType === "removed";
    const isNew =
        fileType === "add" ||
        fileType === "added" ||
        fileType === "create" ||
        fileType === "created" ||
        fileType === "new";

    const sections: string[] = [];
    sections.push("[FILE_METADATA]");
    sections.push(`Project: ${project.name}`);
    sections.push(`Path: ${filePath}`);
    if (fileType) {
        sections.push(`Change: ${fileType}`);
    }

    const resolvedPath = await resolveProjectFilePath(project.path, filePath);
    let fileContent: string | null = null;
    if (!isDeleted && resolvedPath) {
        fileContent = await loadFileContent(resolvedPath);
    }

    // For modified files, always include the diff so AI can see what changed
    const diff = await loadFileDiff(project.path, filePath);
    const isModified = !isDeleted && !isNew && Boolean(fileContent);

    if (isModified && diff && fileContent) {
        // Modified: include both content and diff
        sections.push("[FILE_CONTENT]");
        sections.push(fileContent);
        sections.push("[FILE_DIFF]");
        sections.push(diff);
    } else if (fileContent) {
        // New file: content is the "diff"
        sections.push("[FILE_CONTENT]");
        sections.push(fileContent);
    } else if (diff) {
        // Deleted or unreadable: show diff
        sections.push("[FILE_DIFF]");
        sections.push(diff);
    } else {
        sections.push("[NO_CONTENT_AVAILABLE]");
    }
    const callSites = await collectCallSites({
        projectPath: project.path,
        filePath,
        fileContent,
    });
    if (callSites.length > 0) {
        sections.push("[CALL_SITES]");
        for (const snippet of callSites) {
            sections.push(snippet);
        }
    }

    const context = sections.join("\n\n");
    if (context.length > MAX_CONTEXT_CHARS) {
        return `${context.substring(0, MAX_CONTEXT_CHARS)}\n\n(truncated)`;
    }

    return context;
}

async function loadProjectDiff(projectPath: string): Promise<string | null> {
    try {
        const diff = await runGit(
            ["diff", "--no-ext-diff", "--no-textconv", "--no-color", "HEAD"],
            {
                projectPath,
                label: "AIContext",
                noTrim: true,
                timeoutMs: 20000,
            },
        );
        if (!diff) return null;
        return truncateText(diff, MAX_DIFF_CHARS, "diff truncated");
    } catch (err: unknown) {
        console.error("[AI Context] Project diff read failed:", err);
        return null;
    }
}

async function loadFileDiff(
    projectPath: string,
    filePath: string,
): Promise<string | null> {
    try {
        const diff = await runGit(
            [
                "diff",
                "--no-ext-diff",
                "--no-textconv",
                "--no-color",
                `-U${DIFF_CONTEXT_LINES}`,
                "HEAD",
                "--",
                filePath,
            ],
            {
                projectPath,
                label: "AIContext",
                noTrim: true,
                timeoutMs: 20000,
            },
        );
        if (!diff) return null;
        return truncateText(diff, MAX_DIFF_CHARS, "diff truncated");
    } catch (err: unknown) {
        console.error("[AI Context] File diff read failed:", err);
        return null;
    }
}

async function loadFileContent(filePath: string): Promise<string | null> {
    try {
        const fileStat = await stat(filePath);
        if (!fileStat.isFile() || fileStat.size > MAX_FILE_BYTES) {
            return null;
        }
        const content = await readFile(filePath, "utf8");
        return truncateText(content, MAX_FILE_CHARS, "file content truncated");
    } catch (err: unknown) {
        console.error("[AI Context] File read failed:", err);
        return null;
    }
}

async function collectCallSites({
    projectPath,
    filePath,
    fileContent,
}: {
    projectPath: string;
    filePath: string;
    fileContent: string | null;
}): Promise<string[]> {
    if (!fileContent) return [];

    const exportedSymbols = extractExportedSymbols(fileContent);
    if (exportedSymbols.length === 0) return [];

    const snippets: string[] = [];
    const fileCache = new Map<string, string[] | null>();
    let totalChars = 0;

    const maxSymbolCount = 3;
    const limitedSymbols = exportedSymbols.slice(0, maxSymbolCount);
    for (const symbol of limitedSymbols) {
        if (snippets.length >= MAX_CALL_SITE_FILES) break;
        const matches = await findCallSiteMatches(
            projectPath,
            filePath,
            symbol,
        );
        for (const match of matches) {
            if (snippets.length >= MAX_CALL_SITE_FILES) break;
            const snippet = await buildSnippetForMatch(
                match,
                projectPath,
                fileCache,
            );
            if (!snippet) continue;
            if (totalChars + snippet.length > MAX_CALL_SITE_CHARS) {
                return snippets;
            }
            snippets.push(snippet);
            totalChars += snippet.length;
        }
    }

    return snippets;
}

function extractExportedSymbols(content: string): string[] {
    const patterns = [
        /export\s+function\s+([A-Za-z0-9_]+)/g,
        /export\s+async\s+function\s+([A-Za-z0-9_]+)/g,
        /export\s+class\s+([A-Za-z0-9_]+)/g,
        /export\s+interface\s+([A-Za-z0-9_]+)/g,
        /export\s+type\s+([A-Za-z0-9_]+)/g,
        /export\s+enum\s+([A-Za-z0-9_]+)/g,
        /export\s+(const|let|var)\s+([A-Za-z0-9_]+)/g,
    ];

    const symbols = new Set<string>();
    for (const pattern of patterns) {
        let match = pattern.exec(content);
        while (match) {
            const name = match[2] ?? match[1];
            if (name) {
                symbols.add(name);
            }
            match = pattern.exec(content);
        }
    }

    return Array.from(symbols);
}

async function findCallSiteMatches(
    projectPath: string,
    filePath: string,
    symbol: string,
): Promise<Array<{ path: string; line: number }>> {
    try {
        const output = await runGit(
            [
                "grep",
                "-n",
                "-m",
                "1",
                "-w",
                "-e",
                symbol,
                "--",
                ".",
                `:(exclude)${filePath}`,
            ],
            {
                projectPath,
                label: "AIContext",
                noTrim: true,
                logOnError: false,
                timeoutMs: 5000,
            },
        );
        if (!output) return [];
        const lines = output
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);

        const matches: Array<{ path: string; line: number }> = [];
        for (const line of lines) {
            const match = line.match(/^(.*?):(\d+):/);
            if (!match) continue;
            const lineNumber = Number(match[2]);
            if (!Number.isFinite(lineNumber)) continue;
            matches.push({ path: match[1], line: lineNumber });
        }
        return matches;
    } catch (err: unknown) {
        console.error("[AI Context] Call-site grep failed:", err);
        return [];
    }
}

async function buildSnippetForMatch(
    match: { path: string; line: number },
    projectPath: string,
    fileCache: Map<string, string[] | null>,
): Promise<string | null> {
    try {
        const lines = await loadFileLines(projectPath, match.path, fileCache);
        if (!lines) return null;
        const start = Math.max(match.line - 1 - CALL_SITE_CONTEXT_LINES, 0);
        const end = Math.min(
            match.line - 1 + CALL_SITE_CONTEXT_LINES,
            lines.length - 1,
        );
        const snippetLines = lines.slice(start, end + 1).join("\n");
        return `${match.path}:${match.line}\n${snippetLines}`;
    } catch (err: unknown) {
        console.error("[AI Context] Call-site snippet failed:", err);
        return null;
    }
}

async function loadFileLines(
    projectPath: string,
    relativePath: string,
    fileCache: Map<string, string[] | null>,
): Promise<string[] | null> {
    if (fileCache.has(relativePath)) {
        const cached = fileCache.get(relativePath);
        return cached ?? null;
    }

    try {
        const absolutePath = await resolveProjectFilePath(
            projectPath,
            relativePath,
        );
        if (!absolutePath) {
            fileCache.set(relativePath, null);
            return null;
        }
        const content = await readFile(absolutePath, "utf8");
        const lines = content.split("\n");
        fileCache.set(relativePath, lines);
        return lines;
    } catch (err: unknown) {
        console.error("[AI Context] Call-site file read failed:", err);
        fileCache.set(relativePath, null);
        return null;
    }
}

async function resolveProjectFilePath(
    projectPath: string,
    filePath: string,
): Promise<string | null> {
    try {
        const root = await realpath(projectPath);
        const resolved = await realpath(resolve(root, filePath));
        const rel = relative(root, resolved);
        if (rel.startsWith("..") || rel.includes("..")) {
            return null;
        }
        return resolved;
    } catch (err: unknown) {
        console.error("[AI Context] Path resolution failed:", err);
        return null;
    }
}

function truncateText(text: string, maxChars: number, label: string): string {
    if (text.length <= maxChars) return text;
    return `${text.substring(0, maxChars)}\n\n(${label})`;
}

interface TimeRange {
    since: Date;
    label: string;
}

function parseTimeRange(question: string): TimeRange {
    const lower = question.toLowerCase();
    const now = new Date();

    if (lower.includes("today")) {
        const since = new Date(now);
        since.setHours(0, 0, 0, 0);
        return { since, label: "Today" };
    }

    if (lower.includes("yesterday")) {
        const since = new Date(now);
        since.setDate(since.getDate() - 1);
        since.setHours(0, 0, 0, 0);
        return { since, label: "Since yesterday" };
    }

    if (lower.includes("this week")) {
        const since = new Date(now);
        since.setDate(since.getDate() - since.getDay());
        since.setHours(0, 0, 0, 0);
        return { since, label: "This week" };
    }

    const daysMatch = lower.match(/last\s+(\d+)\s+days?/);
    if (daysMatch) {
        const days = parseInt(daysMatch[1], 10);
        const since = new Date(now);
        since.setDate(since.getDate() - days);
        return { since, label: `Last ${days} days` };
    }

    const hoursMatch = lower.match(/last\s+(\d+)\s+hours?/);
    if (hoursMatch) {
        const hours = parseInt(hoursMatch[1], 10);
        const since = new Date(now);
        since.setHours(since.getHours() - hours);
        return { since, label: `Last ${hours} hours` };
    }

    const since = new Date(now);
    since.setHours(since.getHours() - 24);
    return { since, label: "Last 24 hours" };
}
