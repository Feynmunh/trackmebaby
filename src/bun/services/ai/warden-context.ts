import type { Database } from "bun:sqlite";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
    getGitSnapshots,
    getLatestGitSnapshot,
    getRecentEvents,
} from "../../db/queries.ts";

const MAX_CONTEXT_CHARS = 16000;

export async function assembleWardenContext(
    db: Database,
    projectId: string,
    projectPath?: string | null,
): Promise<string> {
    const header = buildHeaderSection(projectId);

    // Build all sections with try/catch isolation
    const buildSection = (
        name: string,
        builder: () => string | null,
    ): string | null => {
        try {
            return builder();
        } catch (err: unknown) {
            console.error(`[Warden Context] ${name} failed:`, err);
            return null;
        }
    };

    const commits = buildSection("Recent commits", () =>
        buildRecentCommitsSection(db, projectId),
    );
    const uncommitted = buildSection("Uncommitted changes", () =>
        buildUncommittedSection(db, projectId),
    );
    const activity = buildSection("File activity", () =>
        buildFileActivitySection(db, projectId),
    );
    const insights = buildSection("Existing insights", () =>
        buildExistingInsightsSection(db, projectId),
    );
    const files = buildSection("Project files", () =>
        projectPath ? buildProjectFilesSection(projectPath) : null,
    );

    // Budget-based assembly: highest-priority sections are protected from truncation.
    // Priority order (highest first):
    //   1. Header + Insights (dedup/memory — critical for quality)
    //   2. Project files (grounding — prevents hallucinated paths)
    //   3. Uncommitted changes (current state)
    //   4. File activity (trends)
    //   5. Commits (history — lowest priority, most verbose)
    const prioritized: string[] = [header];
    const budgetSections = [
        insights, // highest priority — dedup + memory
        files, // grounding
        uncommitted,
        activity,
        commits, // lowest priority — can be truncated
    ];

    let remaining = MAX_CONTEXT_CHARS - header.length - 10; // reserve for separators

    for (const section of budgetSections) {
        if (!section) continue;
        if (section.length <= remaining) {
            prioritized.push(section);
            remaining -= section.length + 2; // +2 for \n\n separator
        } else if (remaining > 200) {
            // Truncate this section to fit remaining budget
            prioritized.push(
                section.substring(0, remaining - 20) + "\n(section truncated)",
            );
            remaining = 0;
        }
        // else: skip section entirely
    }

    return prioritized.join("\n\n");
}

function buildHeaderSection(projectId: string): string {
    return [
        "[WARDEN_ANALYSIS_CONTEXT]",
        `Project ID: ${projectId}`,
        `Generated: ${new Date().toISOString()}`,
    ].join("\n");
}

function buildRecentCommitsSection(
    db: Database,
    projectId: string,
): string | null {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const snapshots = getGitSnapshots(db, projectId, thirtyDaysAgo, 10);
    if (snapshots.length === 0) return null;

    const lines: string[] = ["[RECENT_COMMITS]"];
    const branch = snapshots[0]?.branch ?? "unknown";
    lines.push(`Branch: ${branch}`);
    for (const snapshot of snapshots) {
        const shortHash = (snapshot.lastCommitHash ?? "unknown").slice(0, 8);
        const message = snapshot.lastCommitMessage ?? "";
        const timestamp = snapshot.lastCommitTimestamp ?? snapshot.timestamp;
        lines.push(`${shortHash} | ${message} | ${timestamp}`);
    }

    return lines.join("\n");
}

function buildUncommittedSection(
    db: Database,
    projectId: string,
): string | null {
    const snapshot = getLatestGitSnapshot(db, projectId);
    if (!snapshot || snapshot.uncommittedCount === 0) return null;

    const files = snapshot.uncommittedFiles.slice(0, 10);
    const lines = [
        "[UNCOMMITTED_CHANGES]",
        `${snapshot.uncommittedCount} files with uncommitted changes:`,
        ...files.map((file) => `  - ${file}`),
    ];
    return lines.join("\n");
}

function buildFileActivitySection(
    db: Database,
    projectId: string,
): string | null {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const events = getRecentEvents(db, projectId, sevenDaysAgo, 500);
    if (events.length === 0) return null;

    // Count unique files per event type (not raw event count)
    const createdFiles = new Set<string>();
    const modifiedFiles = new Set<string>();
    const deletedFiles = new Set<string>();

    for (const event of events) {
        if (event.type === "file_create") createdFiles.add(event.filePath);
        if (event.type === "file_modify") modifiedFiles.add(event.filePath);
        if (event.type === "file_delete") deletedFiles.add(event.filePath);
    }

    // Deduplicate: count active days per file instead of raw saves
    const fileDays = new Map<string, Set<string>>();
    for (const event of events) {
        if (event.type !== "file_modify") continue;
        const day = new Date(event.timestamp).toISOString().slice(0, 10);
        if (!fileDays.has(event.filePath)) {
            fileDays.set(event.filePath, new Set());
        }
        fileDays.get(event.filePath)!.add(day);
    }

    const topModified = Array.from(fileDays.entries())
        .map(([filePath, days]) => ({ filePath, activeDays: days.size }))
        .sort((a, b) => b.activeDays - a.activeDays)
        .slice(0, 10);

    const lines = [
        "[FILE_ACTIVITY_7_DAYS]",
        `${createdFiles.size} files created, ${modifiedFiles.size} files modified, ${deletedFiles.size} files deleted`,
        "Top modified files (by active days out of 7):",
        ...topModified.map(
            ({ filePath, activeDays }) =>
                `  - ${filePath} (active ${activeDays} of 7 days)`,
        ),
    ];

    return lines.join("\n");
}

function buildExistingInsightsSection(
    db: Database,
    projectId: string,
): string | null {
    // Active insights the AI should not regenerate
    const newRows = db
        .query(
            "SELECT title FROM warden_insights WHERE project_id = ? AND status = 'new'",
        )
        .all(projectId) as { title: string }[];

    // Dismissed insights — user rejected these, never regenerate similar ones
    const dismissedRows = db
        .query(
            "SELECT title FROM warden_insights WHERE project_id = ? AND status = 'dismissed' ORDER BY resolved_at DESC LIMIT 20",
        )
        .all(projectId) as { title: string }[];

    // Approved/liked insights — user valued these, generate more like them
    const valuedRows = db
        .query(
            "SELECT title, category FROM warden_insights WHERE project_id = ? AND status IN ('approved', 'liked') ORDER BY resolved_at DESC LIMIT 15",
        )
        .all(projectId) as { title: string; category: string }[];

    const sections: string[] = [];

    const newTitles = [...new Set(newRows.map((r) => r.title).filter(Boolean))];
    if (newTitles.length > 0) {
        sections.push(
            "[EXISTING_INSIGHTS - DO NOT REPEAT THESE]",
            ...newTitles.map((title) => `- ${title}`),
        );
    }

    const dismissedTitles = [
        ...new Set(dismissedRows.map((r) => r.title).filter(Boolean)),
    ];
    if (dismissedTitles.length > 0) {
        sections.push(
            "",
            "[DISMISSED_INSIGHTS - USER REJECTED THESE. DO NOT regenerate these or similar insights]",
            ...dismissedTitles.map((title) => `- ${title}`),
        );
    }

    const valuedTitles = [
        ...new Set(
            valuedRows.map((r) => `${r.title} [${r.category}]`).filter(Boolean),
        ),
    ];
    if (valuedTitles.length > 0) {
        sections.push(
            "",
            "[VALUED_INSIGHTS - USER APPROVED THESE. Generate more insights in these categories/styles]",
            ...valuedTitles.map((title) => `- ${title}`),
        );
    }

    if (sections.length === 0) return null;
    return sections.join("\n");
}

const PROJECT_FILES_IGNORE = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    ".cache",
    "coverage",
    ".turbo",
]);

const MAX_PROJECT_FILES = 100;

function buildProjectFilesSection(projectPath: string): string | null {
    const files: string[] = [];

    function walk(dir: string, depth: number): void {
        if (depth > 4 || files.length >= MAX_PROJECT_FILES) return;
        let entries: string[];
        try {
            entries = readdirSync(dir);
        } catch {
            return;
        }
        for (const entry of entries) {
            if (files.length >= MAX_PROJECT_FILES) return;
            if (PROJECT_FILES_IGNORE.has(entry) || entry.startsWith(".")) {
                continue;
            }
            const full = join(dir, entry);
            try {
                const stat = statSync(full);
                if (stat.isDirectory()) {
                    walk(full, depth + 1);
                } else if (stat.isFile()) {
                    files.push(relative(projectPath, full));
                }
            } catch {}
        }
    }

    walk(projectPath, 0);
    if (files.length === 0) return null;

    const lines = [
        "[PROJECT_FILES]",
        `${files.length} source files found (max ${MAX_PROJECT_FILES}):`,
        ...files.map((f) => `  - ${f}`),
    ];
    return lines.join("\n");
}
