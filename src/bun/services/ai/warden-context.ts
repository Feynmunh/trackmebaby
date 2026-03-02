import type { Database } from "bun:sqlite";
import {
    getAllRecentEvents,
    getGitSnapshots,
    getLatestGitSnapshot,
} from "../../db/queries.ts";

const MAX_CONTEXT_CHARS = 16000;

export async function assembleWardenContext(
    db: Database,
    projectId: string,
): Promise<string> {
    const sections: string[] = [];
    sections.push(buildHeaderSection(projectId));

    try {
        const commitsSection = buildRecentCommitsSection(db, projectId);
        if (commitsSection) {
            sections.push(commitsSection);
        }
    } catch (err: unknown) {
        console.error("[Warden Context] Recent commits failed:", err);
    }

    try {
        const uncommittedSection = buildUncommittedSection(db, projectId);
        if (uncommittedSection) {
            sections.push(uncommittedSection);
        }
    } catch (err: unknown) {
        console.error("[Warden Context] Uncommitted changes failed:", err);
    }

    try {
        const activitySection = buildFileActivitySection(db, projectId);
        if (activitySection) {
            sections.push(activitySection);
        }
    } catch (err: unknown) {
        console.error("[Warden Context] File activity failed:", err);
    }

    try {
        const insightsSection = buildExistingInsightsSection(db, projectId);
        if (insightsSection) {
            sections.push(insightsSection);
        }
    } catch (err: unknown) {
        console.error("[Warden Context] Existing insights failed:", err);
    }

    const context = sections.join("\n\n");
    if (context.length > MAX_CONTEXT_CHARS) {
        return `${context.substring(0, MAX_CONTEXT_CHARS)}\n\n(truncated)`;
    }
    return context;
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
        lines.push(
            `${shortHash} | ${message} | ${timestamp} | ${snapshot.uncommittedCount} uncommitted`,
        );
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
    const events = getAllRecentEvents(db, sevenDaysAgo).filter(
        (event) => event.projectId === projectId,
    );
    if (events.length === 0) return null;

    const creates = events.filter(
        (event) => event.type === "file_create",
    ).length;
    const modifies = events.filter(
        (event) => event.type === "file_modify",
    ).length;
    const deletes = events.filter(
        (event) => event.type === "file_delete",
    ).length;

    const modificationCounts = new Map<string, number>();
    for (const event of events) {
        if (event.type !== "file_modify") continue;
        modificationCounts.set(
            event.filePath,
            (modificationCounts.get(event.filePath) ?? 0) + 1,
        );
    }

    const topModified = Array.from(modificationCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const lines = [
        "[FILE_ACTIVITY_7_DAYS]",
        `${creates} created, ${modifies} modified, ${deletes} deleted`,
        "Top modified files:",
        ...topModified.map(
            ([filePath, count]) => `  - ${filePath} (appears ${count} times)`,
        ),
    ];

    return lines.join("\n");
}

function buildExistingInsightsSection(
    db: Database,
    projectId: string,
): string | null {
    const rows = db
        .query(
            "SELECT title FROM warden_insights WHERE project_id = ? AND status = 'new'",
        )
        .all(projectId) as { title: string }[];
    if (rows.length === 0) return null;

    const uniqueTitles = Array.from(
        new Set(rows.map((row) => row.title).filter(Boolean)),
    );
    if (uniqueTitles.length === 0) return null;

    const lines = [
        "[EXISTING_INSIGHTS - DO NOT REPEAT THESE]",
        ...uniqueTitles.map((title) => `- ${title}`),
    ];
    return lines.join("\n");
}
