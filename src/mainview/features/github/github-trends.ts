import { nowIso } from "../../../shared/time.ts";
import type { GitHubIssue, GitHubPR } from "../../../shared/types.ts";

export function buildTrend(
    items: Array<GitHubIssue | GitHubPR>,
    closedAtSelector: (
        item: GitHubIssue | GitHubPR,
    ) => string | null | undefined,
): Array<{ timestamp: string; insertions: number; deletions: number }> {
    if (items.length === 0) {
        return [
            {
                timestamp: nowIso(),
                insertions: 0,
                deletions: 0,
            },
        ];
    }

    // Create an event for every creation and every closure/merge
    const events: Array<{ timestamp: number; type: "create" | "close" }> = [];

    for (const item of items) {
        events.push({
            timestamp: new Date(item.createdAt).getTime(),
            type: "create",
        });

        const closedAt = closedAtSelector(item);
        if (closedAt) {
            events.push({
                timestamp: new Date(closedAt).getTime(),
                type: "close",
            });
        }
    }

    // Sort all events chronologically
    events.sort((a, b) => a.timestamp - b.timestamp);

    let total = 0;
    let closed = 0;
    const points: Array<{
        timestamp: string;
        insertions: number;
        deletions: number;
    }> = [];

    for (const event of events) {
        if (event.type === "create") {
            total += 1;
        } else {
            closed += 1;
        }

        points.push({
            timestamp: new Date(event.timestamp).toISOString(),
            insertions: total,
            deletions: closed,
        });
    }

    return points;
}
