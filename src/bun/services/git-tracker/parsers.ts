export interface ParsedCommit {
    hash: string;
    message: string;
    timestamp: string;
    author: string;
    insertions: number;
    deletions: number;
}

export const COMMIT_MARKER = "--commit--";

export interface DiffSummary {
    filesChanged: number;
    insertions: number;
    deletions: number;
}

export function parseGitLog(output: string): ParsedCommit[] {
    if (!output.trim()) return [];
    const lines = output.split("\n");
    const commits: ParsedCommit[] = [];
    let currentCommit: ParsedCommit | null = null;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith(COMMIT_MARKER)) {
            if (currentCommit) commits.push(currentCommit);
            const payload = trimmed.slice(COMMIT_MARKER.length);
            const parts = payload.split("|");
            const hash = parts.shift() ?? "";
            const author = parts.pop() ?? "";
            const timestamp = parts.pop() ?? "";
            const message = parts.join("|");
            currentCommit = {
                hash,
                message,
                timestamp,
                author,
                insertions: 0,
                deletions: 0,
            };
        } else if (currentCommit) {
            const parts = trimmed.split(/\s+/);
            if (parts.length >= 2) {
                const ins = parseInt(parts[0], 10);
                const del = parseInt(parts[1], 10);
                if (!Number.isNaN(ins)) currentCommit.insertions += ins;
                if (!Number.isNaN(del)) currentCommit.deletions += del;
            }
        }
    }

    if (currentCommit) commits.push(currentCommit);
    return commits;
}

export function parseDiffStat(output: string): DiffSummary {
    const filesMatch = output.match(/(\d+) files? changed/);
    const insMatch = output.match(/(\d+) insertions?\(\+\)/);
    const delMatch = output.match(/(\d+) deletions?\(-\)/);

    return {
        filesChanged: filesMatch ? parseInt(filesMatch[1], 10) : 0,
        insertions: insMatch ? parseInt(insMatch[1], 10) : 0,
        deletions: delMatch ? parseInt(delMatch[1], 10) : 0,
    };
}

export function parseBranches(output: string): string[] {
    if (!output.trim()) return [];
    return output
        .split("\n")
        .map((line) => line.replace(/^\*?\s+/, "").trim())
        .filter((line) => line.length > 0);
}
