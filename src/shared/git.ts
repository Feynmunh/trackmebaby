interface GitCommandOutput {
    text(): string;
}

export function parseGitOutputLines(output: string): string[] {
    return output
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
}

export function readGitOutput(result: GitCommandOutput): string {
    return result.text().trim();
}

export function readGitOutputLines(result: GitCommandOutput): string[] {
    return parseGitOutputLines(readGitOutput(result));
}

export function parseGitStatusPorcelain(output: string): string[] {
    return output
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            if (line.length <= 2) return "";
            // Git status codes: X = index status, Y = worktree status
            // Common: " M" = modified in worktree, "M " = modified in index, "MM" = both
            // After trim(), we may have "M filename" or "Mfilename"
            const indexStatus = line[0];
            const worktreeStatus = line[1];
            // Skip deleted files (D in either position means file is gone)
            if (indexStatus === "D" || worktreeStatus === "D") {
                return "";
            }
            // Extract path by finding where the filename starts (after status chars)
            let pathPart = line.slice(2).trim();
            if (!pathPart) return "";
            // Handle renamed files: "R  original -> new"
            if (pathPart.includes(" -> ")) {
                pathPart = pathPart.split(" -> ").pop() ?? "";
            }
            return pathPart;
        })
        .filter(Boolean);
}
