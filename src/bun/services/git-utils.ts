import { statSync } from "node:fs";
import { join } from "node:path";
import { toErrorData } from "../../shared/error.ts";
import { parseGitStatusPorcelain } from "../../shared/git.ts";
import { createLogger } from "../../shared/logger.ts";
import { runGit } from "./git-command.ts";

const logger = createLogger("git-utils");

interface UncommittedFileStatus {
    uncommittedFiles: string[];
    latestMtime: Date | null;
    fileMtimes: Map<string, string>;
}

export async function getUncommittedFileStatus(
    projectPath: string,
    label: string,
): Promise<UncommittedFileStatus> {
    let uncommittedFiles: string[] = [];
    let latestMtime: Date | null = null;
    const fileMtimes = new Map<string, string>();

    const output = await runGit(["status", "--porcelain"], {
        projectPath,
        label,
        timeoutMs: 5000,
    });
    if (!output) {
        return { uncommittedFiles, latestMtime, fileMtimes };
    }

    uncommittedFiles = parseGitStatusPorcelain(output);

    for (const file of uncommittedFiles) {
        try {
            const fullPath = join(projectPath, file);
            const stats = statSync(fullPath);
            fileMtimes.set(file, stats.mtime.toISOString());
            if (!latestMtime || stats.mtime > latestMtime) {
                latestMtime = stats.mtime;
            }
        } catch (err: unknown) {
            logger.warn("failed to stat file", {
                label,
                projectPath,
                file,
                error: toErrorData(err),
            });
        }
    }

    return { uncommittedFiles, latestMtime, fileMtimes };
}
