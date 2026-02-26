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
    return parseGitOutputLines(output)
        .map((line) => {
            if (line.length <= 3) return "";
            const pathPart = line.slice(3).trim();
            if (!pathPart) return "";
            if (pathPart.includes(" -> ")) {
                return pathPart.split(" -> ").pop() ?? "";
            }
            return pathPart;
        })
        .filter(Boolean);
}
