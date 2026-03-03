import type { GitSnapshot, Project } from "../../../shared/types.ts";

export function getVitalityStatus(
    project: Project,
    eventCount: number,
    gitSnapshot?: GitSnapshot | null,
): { label: string; colorClass: string; bgClass: string } {
    const lastActivity = project.lastActivityAt
        ? new Date(project.lastActivityAt)
        : null;
    const hoursSinceActivity = lastActivity
        ? (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60)
        : Infinity;

    if (
        eventCount > 0 ||
        (gitSnapshot?.uncommittedCount ?? 0) > 0 ||
        hoursSinceActivity < 24
    ) {
        return {
            label: "Active",
            colorClass: "text-blue-400",
            bgClass: "bg-blue-500/10",
        };
    }
    if (hoursSinceActivity < 24 * 7) {
        return {
            label: "Idle",
            colorClass: "text-amber-400",
            bgClass: "bg-amber-500/10",
        };
    }
    return {
        label: "Dormant",
        colorClass: "text-app-text-muted",
        bgClass: "bg-app-border",
    };
}
