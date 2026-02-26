/**
 * AI Context Assembler — builds a human-readable activity summary for the AI
 * Parses time ranges from questions, gathers events + git snapshots,
 * formats per-project summaries, and stays under ~4000 tokens
 */
import type { Database } from "bun:sqlite";
import {
    getAllRecentEvents,
    getLatestGitSnapshot,
    getProjects,
} from "../../db/queries.ts";

const MAX_CONTEXT_CHARS = 14000; // ~3500 tokens (4 chars per token avg)

/**
 * Assemble a context string from recent activity for the AI.
 * Parses simple time expressions from the question.
 */
export function assembleContext(db: Database, question: string): string {
    const timeRange = parseTimeRange(question);
    const since = timeRange.since;
    const projects = getProjects(db);

    if (projects.length === 0) {
        return "No projects are currently being tracked. The user has not set up any projects yet.";
    }

    const sections: string[] = [];
    sections.push(`Activity Report (${timeRange.label})`);
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

    for (const project of projects) {
        const events = eventsByProject.get(project.id) ?? [];
        const gitSnapshot = getLatestGitSnapshot(db, project.id);

        // Skip projects with no recent activity
        if (events.length === 0 && !gitSnapshot) continue;

        const projectSection: string[] = [];
        projectSection.push(`## ${project.name} (${project.path})`);

        // Git info
        if (gitSnapshot) {
            projectSection.push(`  Branch: ${gitSnapshot.branch}`);
            if (gitSnapshot.lastCommitMessage) {
                projectSection.push(
                    `  Last commit: "${gitSnapshot.lastCommitMessage}"`,
                );
            }
            if (gitSnapshot.uncommittedCount > 0) {
                projectSection.push(
                    `  Uncommitted changes: ${gitSnapshot.uncommittedCount} files`,
                );
                const files = gitSnapshot.uncommittedFiles.slice(0, 5);
                for (const f of files) {
                    projectSection.push(`    - ${f}`);
                }
                if (gitSnapshot.uncommittedFiles.length > 5) {
                    projectSection.push(
                        `    ... and ${gitSnapshot.uncommittedFiles.length - 5} more`,
                    );
                }
            }
        }

        // File activity summary
        if (events.length > 0) {
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
                `  File activity: ${creates} created, ${modifies} modified, ${deletes} deleted`,
            );

            // Show most recent files (max 8)
            const recentFiles = [
                ...new Set(events.map((e) => e.filePath)),
            ].slice(0, 8);
            projectSection.push(`  Recent files:`);
            for (const f of recentFiles) {
                projectSection.push(`    - ${f}`);
            }
        }

        sections.push(projectSection.join("\n"));

        // Check budget
        if (sections.join("\n\n").length > MAX_CONTEXT_CHARS) {
            sections.push("(Activity truncated to fit context window)");
            break;
        }
    }

    const context = sections.join("\n\n");

    // Final truncation safety
    if (context.length > MAX_CONTEXT_CHARS) {
        return `${context.substring(0, MAX_CONTEXT_CHARS)}\n\n(truncated)`;
    }

    return context;
}

interface TimeRange {
    since: Date;
    label: string;
}

/**
 * Parse simple time expressions from a question.
 * Supports: today, this week, yesterday, last N days/hours
 */
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

    // "last N days"
    const daysMatch = lower.match(/last\s+(\d+)\s+days?/);
    if (daysMatch) {
        const days = parseInt(daysMatch[1], 10);
        const since = new Date(now);
        since.setDate(since.getDate() - days);
        return { since, label: `Last ${days} days` };
    }

    // "last N hours"
    const hoursMatch = lower.match(/last\s+(\d+)\s+hours?/);
    if (hoursMatch) {
        const hours = parseInt(hoursMatch[1], 10);
        const since = new Date(now);
        since.setHours(since.getHours() - hours);
        return { since, label: `Last ${hours} hours` };
    }

    // Default: last 24 hours
    const since = new Date(now);
    since.setHours(since.getHours() - 24);
    return { since, label: "Last 24 hours" };
}
