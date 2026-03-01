import type {
    ChangeContent,
    ContextContent,
    FileDiffMetadata,
} from "@pierre/diffs";
import { parsePatchFiles } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import { ChevronDown, ChevronRight, GitBranch, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { GitSnapshot, Project } from "../../../../shared/types.ts";
import { getGitDiff, queryAI } from "../../../rpc.ts";

const diffUnsafeCSS = `
    [data-diffs-header] {
        background-color: #1e1e1e !important;
        border-bottom: 1px solid #30363d;
    }
    [data-diffs] {
        background-color: #0d1117 !important;
    }
    pre {
        background-color: transparent !important;
    }
    [data-diff-added], .diff-added {
        background-color: rgba(34, 197, 94, 0.15) !important;
    }
    [data-diff-removed], .diff-removed {
        background-color: rgba(244, 63, 94, 0.15) !important;
    }
`;

interface DiffViewProps {
    project: Project;
    gitSnapshot: GitSnapshot;
    onClose: () => void;
}

export default function DiffView({
    project,
    gitSnapshot,
    onClose,
}: DiffViewProps) {
    const [diffContent, setDiffContent] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [diffError, setDiffError] = useState<string | null>(null);
    const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>(
        {},
    );
    const [fileSummaries, setFileSummaries] = useState<Record<string, string>>(
        {},
    );
    const [fileSummaryLoading, setFileSummaryLoading] = useState<
        Record<string, boolean>
    >({});
    const [fileSummaryErrors, setFileSummaryErrors] = useState<
        Record<string, string>
    >({});

    useEffect(() => {
        const fetchDiff = async () => {
            try {
                const result = await getGitDiff(project.id);
                setDiffContent(result.diff);
                setDiffError(result.error ?? null);
            } catch (err) {
                console.error("Failed to fetch git diff:", err);
                setDiffError("Unable to load git diff.");
            } finally {
                setLoading(false);
            }
        };
        fetchDiff();
    }, [project.id]);

    useEffect(() => {
        setExpandedFiles({});
        setFileSummaries({});
        setFileSummaryLoading({});
        setFileSummaryErrors({});
    }, [diffContent]);

    const isChangeContent = (
        entry: ContextContent | ChangeContent,
    ): entry is ChangeContent => entry.type === "change";

    const buildDiffSnippet = (file: FileDiffMetadata): string => {
        const maxLines = 16;
        const lines: string[] = [];

        for (const hunk of file.hunks ?? []) {
            const contents = hunk.hunkContent ?? [];
            for (const entry of contents) {
                if (lines.length >= maxLines) break;
                if (!isChangeContent(entry)) continue;

                for (const addition of entry.additions) {
                    if (lines.length >= maxLines) break;
                    lines.push(`+ ${addition}`);
                }

                for (const deletion of entry.deletions) {
                    if (lines.length >= maxLines) break;
                    lines.push(`- ${deletion}`);
                }
            }
            if (lines.length >= maxLines) break;
        }

        return lines.join("\n");
    };

    const getChangeStats = (file: FileDiffMetadata) => {
        let added = 0;
        let removed = 0;

        for (const hunk of file.hunks ?? []) {
            for (const entry of hunk.hunkContent ?? []) {
                if (!isChangeContent(entry)) continue;
                added += entry.additions.length;
                removed += entry.deletions.length;
            }
        }

        return { added, removed };
    };

    const fetchFileSummary = async (
        fileKey: string,
        file: FileDiffMetadata,
        addedLines: number,
        removedLines: number,
    ) => {
        setFileSummaryLoading((prev) => ({ ...prev, [fileKey]: true }));
        setFileSummaryErrors((prev) => ({ ...prev, [fileKey]: "" }));

        try {
            const diffSnippet = buildDiffSnippet(file);
            const prompt = `Summarize the changes in the file "${file.name}" in project "${project.name}". Change type: ${file.type ?? "change"}. Lines added: ${addedLines}, lines removed: ${removedLines}. ${diffSnippet ? `Diff snippet:\n${diffSnippet}\n` : ""}Provide a very brief, friendly 1-2 sentence summary. Start with something personal like "It looks like you've been..." or "You've spent some time on...". Keep it concise and professional yet warm.`;
            const response = await queryAI(prompt);
            setFileSummaries((prev) => ({ ...prev, [fileKey]: response }));
        } catch (err) {
            console.error("Failed to fetch file AI summary:", err);
            setFileSummaryErrors((prev) => ({
                ...prev,
                [fileKey]: "Unable to generate a summary right now.",
            }));
        } finally {
            setFileSummaryLoading((prev) => ({ ...prev, [fileKey]: false }));
        }
    };

    const parsed = useMemo(() => {
        if (!diffContent) return { files: [], error: null as string | null };
        try {
            const patches = parsePatchFiles(diffContent);
            return { files: patches.flatMap((p) => p.files), error: null };
        } catch (e) {
            console.error("Failed to parse diff:", e);
            return { files: [], error: "Unable to parse git diff output." };
        }
    }, [diffContent]);

    return (
        <div className="bg-mac-surface/40 backdrop-blur-xl border border-mac-border rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh] max-w-4xl relative">
            <div className="px-8 py-5 border-b border-mac-border flex items-center justify-between bg-mac-surface/20 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50">
                        <GitBranch size={14} className="text-zinc-400" />
                        <span className="text-sm font-semibold text-zinc-200">
                            {gitSnapshot.branch}
                        </span>
                    </div>
                    {loading && (
                        <div className="flex gap-1 ml-2">
                            <span
                                className="w-1 h-1 rounded-full bg-mac-secondary/30 animate-bounce"
                                style={{ animationDelay: "0ms" }}
                            />
                            <span
                                className="w-1 h-1 rounded-full bg-mac-secondary/30 animate-bounce"
                                style={{ animationDelay: "150ms" }}
                            />
                            <span
                                className="w-1 h-1 rounded-full bg-mac-secondary/30 animate-bounce"
                                style={{ animationDelay: "300ms" }}
                            />
                        </div>
                    )}
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-xl hover:bg-mac-border/30 text-mac-secondary transition-colors"
                >
                    <X size={18} />
                </button>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar bg-black">
                {loading ? (
                    <div className="p-12 text-center text-mac-secondary font-medium animate-pulse">
                        Loading diff...
                    </div>
                ) : diffError ? (
                    <div className="p-12 text-center">
                        <p className="text-sm font-medium text-mac-secondary italic">
                            {diffError}
                        </p>
                    </div>
                ) : parsed.error ? (
                    <div className="p-12 text-center">
                        <p className="text-sm font-medium text-mac-secondary italic">
                            {parsed.error}
                        </p>
                    </div>
                ) : parsed.files.length > 0 ? (
                    <div className="flex flex-col gap-4 p-4">
                        {parsed.files.map((file, i) => {
                            const fileKey = `${file.name}-${i}`;
                            const isExpanded = expandedFiles[fileKey] ?? false;
                            const { added: addedLines, removed: removedLines } =
                                getChangeStats(file);

                            return (
                                <div
                                    key={fileKey}
                                    className="bg-gradient-to-br from-zinc-800/80 to-zinc-900/80 border border-zinc-700/50 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
                                >
                                    <div className="px-4 py-3 flex items-center justify-between bg-zinc-800/50 border-b border-zinc-700/30">
                                        <div className="text-sm font-semibold text-zinc-100 truncate">
                                            {file.name}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-mono font-semibold">
                                                <span className="text-emerald-400">
                                                    +{addedLines}
                                                </span>
                                                <span className="text-rose-400 ml-2">
                                                    -{removedLines}
                                                </span>
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const nextExpanded =
                                                        !isExpanded;
                                                    setExpandedFiles(
                                                        (prev) => ({
                                                            ...prev,
                                                            [fileKey]:
                                                                nextExpanded,
                                                        }),
                                                    );
                                                    if (
                                                        nextExpanded &&
                                                        !fileSummaries[
                                                            fileKey
                                                        ] &&
                                                        !fileSummaryLoading[
                                                            fileKey
                                                        ]
                                                    ) {
                                                        void fetchFileSummary(
                                                            fileKey,
                                                            file,
                                                            addedLines,
                                                            removedLines,
                                                        );
                                                    }
                                                }}
                                                className="text-zinc-400 hover:text-zinc-100 transition-colors"
                                                aria-label={
                                                    isExpanded
                                                        ? "Close diff"
                                                        : "Open diff"
                                                }
                                            >
                                                {isExpanded ? (
                                                    <ChevronDown size={18} />
                                                ) : (
                                                    <ChevronRight size={18} />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className="pierre-diff-file">
                                            <div className="px-4 py-4">
                                                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">
                                                    AI Summary
                                                </div>
                                                {fileSummaryLoading[fileKey] ? (
                                                    <div className="space-y-2 mt-3">
                                                        <div className="h-3 bg-zinc-800/70 rounded w-[85%] animate-pulse" />
                                                        <div className="h-3 bg-zinc-800/60 rounded w-[60%] animate-pulse" />
                                                    </div>
                                                ) : fileSummaryErrors[
                                                      fileKey
                                                  ] ? (
                                                    <p className="mt-3 text-sm text-zinc-400">
                                                        {
                                                            fileSummaryErrors[
                                                                fileKey
                                                            ]
                                                        }
                                                    </p>
                                                ) : (
                                                    <p className="mt-3 text-[14px] leading-relaxed text-zinc-200 font-medium">
                                                        {fileSummaries[
                                                            fileKey
                                                        ] ?? ""}
                                                    </p>
                                                )}
                                            </div>
                                            <FileDiff
                                                fileDiff={file}
                                                options={{
                                                    overflow: "wrap",
                                                    theme: "dark-plus",
                                                    expandUnchanged: false,
                                                    hunkSeparators: "line-info",
                                                    disableFileHeader: true,
                                                    unsafeCSS: diffUnsafeCSS,
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="p-20 text-center">
                        <p className="text-sm font-medium text-mac-secondary italic">
                            No differences found in the current draft.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
