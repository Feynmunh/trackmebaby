import { parseGitOutputLines } from "../../shared/git.ts";
import { createLogger, type LogLevel } from "../../shared/logger.ts";

const logger = createLogger("git");

interface GitCommandOptions {
    projectPath?: string;
    label?: string;
    logLevel?: LogLevel;
    logOnError?: boolean;
    timeoutMs?: number;
}

async function readStreamText(
    stream: ReadableStream<Uint8Array> | null,
): Promise<string> {
    if (!stream) return "";
    return await new Response(stream).text();
}

export async function runGit(
    command: string[],
    options: GitCommandOptions = {},
): Promise<string | null> {
    const commandParts = options.projectPath
        ? ["git", "-C", options.projectPath, ...command]
        : ["git", ...command];

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? 8000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const proc = Bun.spawn(commandParts, {
        stdout: "pipe",
        stderr: "pipe",
        signal: controller.signal,
    });

    const [stdout, stderr, exitCode] = await Promise.all([
        readStreamText(proc.stdout),
        readStreamText(proc.stderr),
        proc.exited,
    ]);

    clearTimeout(timeoutId);
    if (exitCode !== 0) {
        if (options.logOnError !== false) {
            const level = options.logLevel ?? "warn";
            const data = {
                command: commandParts.join(" "),
                exitCode,
                label: options.label,
                stderr: stderr.trim() || undefined,
                timedOut: controller.signal.aborted,
            };
            if (level === "debug") logger.debug("git command failed", data);
            else if (level === "info") logger.info("git command failed", data);
            else if (level === "warn") logger.warn("git command failed", data);
            else logger.error("git command failed", data);
        }
        return null;
    }

    return stdout.trim();
}

export async function runGitLines(
    command: string[],
    options: GitCommandOptions = {},
): Promise<string[]> {
    const output = await runGit(command, options);
    if (output === null) return [];
    return parseGitOutputLines(output);
}
