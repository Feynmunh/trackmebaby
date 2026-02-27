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

    const createdSorted = [...items].sort(
        (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const closedSorted = [...items]
        .map((item) => ({ item, closedAt: closedAtSelector(item) }))
        .filter((entry) => entry.closedAt)
        .sort(
            (a, b) =>
                new Date(a.closedAt as string).getTime() -
                new Date(b.closedAt as string).getTime(),
        );

    let total = 0;
    let closed = 0;
    let closedIndex = 0;
    const points = createdSorted.map((item) => {
        total += 1;
        const currentTime = new Date(item.createdAt).getTime();
        while (closedIndex < closedSorted.length) {
            const closedTime = new Date(
                closedSorted[closedIndex].closedAt as string,
            ).getTime();
            if (closedTime <= currentTime) {
                closed += 1;
                closedIndex += 1;
                continue;
            }
            break;
        }
        return {
            timestamp: item.createdAt,
            insertions: total,
            deletions: closed,
        };
    });

    return points.slice(-20);
}
