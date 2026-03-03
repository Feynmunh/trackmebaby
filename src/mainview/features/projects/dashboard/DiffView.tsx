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

const getDiffUnsafeCSS = () => {
    return `
    [data-diffs-header] {
        background-color: hsl(var(--app-surface-elevated)) !important;
        border-bottom: 1px solid hsl(var(--app-border));
    }
    [data-diffs] {
        background-color: hsl(var(--app-bg)) !important;
    }
    [data-diffs] pre {
        background-color: transparent !important;
    }
    [data-diff-added], .diff-added {
        background-color: rgba(34, 197, 94, 0.15) !important;
    }
    [data-diff-removed], .diff-removed {
        background-color: rgba(244, 63, 94, 0.15) !important;
    }
`;
};

const getTheme = (): "light" | "dark" => {
    if (typeof window === "undefined") return "dark";
    return document.documentElement.classList.contains("dark")
        ? "dark"
        : "light";
};

interface DiffViewProps {
    project: Project;
    gitSnapshot: GitSnapshot;
    onClose: () => void;
    refreshKey?: number;
}

export default function DiffView({
    project,
    gitSnapshot,
    onClose,
    refreshKey = 0,
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
    const [theme, setTheme] = useState<"light" | "dark">("dark");

    useEffect(() => {
        setTheme(getTheme());

        const observer = new MutationObserver(() => {
            setTheme(getTheme());
        });
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
        });

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const fetchDiff = async () => {
            setLoading(true);
            setDiffError(null);
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
    }, [project.id, refreshKey]);

    useEffect(() => {
        setExpandedFiles({});
        setFileSummaries({});
        setFileSummaryLoading({});
        setFileSummaryErrors({});
    }, [diffContent]);

    const isChangeContent = (
        entry: ContextContent | ChangeContent,
    ): entry is ChangeContent => entry.type === "change";

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
    ) => {
        setFileSummaryLoading((prev) => ({ ...prev, [fileKey]: true }));
        setFileSummaryErrors((prev) => ({ ...prev, [fileKey]: "" }));

        try {
            const prompt = "Summarize the changes in this file.";

            const response = await queryAI(prompt, {
                task: "file_summary",
                projectId: project.id,
                filePath: file.name,
                fileType: file.type ?? undefined,
            });
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

    const diffUnsafeCSS = useMemo(() => getDiffUnsafeCSS(), []);

    return (
        <div className="bg-app-surface/40 backdrop-blur-xl border border-app-border rounded-3xl overflow-hidden shadow-app-lg flex flex-col max-h-[80vh] max-w-4xl relative">
            <div className="px-8 py-5 border-b border-app-border flex items-center justify-between bg-app-surface/20 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-app-surface-elevated border border-app-border">
                        <GitBranch size={14} className="text-app-text-muted" />
                        <span className="text-sm font-semibold text-app-text-main">
                            {gitSnapshot.branch}
                        </span>
                    </div>
                    {loading && (
                        <div className="flex gap-1 ml-2">
                            <span
                                className="w-1 h-1 rounded-full bg-app-text-muted/30 animate-bounce"
                                style={{ animationDelay: "0ms" }}
                            />
                            <span
                                className="w-1 h-1 rounded-full bg-app-text-muted/30 animate-bounce"
                                style={{ animationDelay: "150ms" }}
                            />
                            <span
                                className="w-1 h-1 rounded-full bg-app-text-muted/30 animate-bounce"
                                style={{ animationDelay: "300ms" }}
                            />
                        </div>
                    )}
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-xl hover:bg-app-border/30 text-app-text-muted transition-colors"
                >
                    <X size={18} />
                </button>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar bg-app-bg">
                {loading ? (
                    <div className="p-12 text-center text-app-text-muted font-medium animate-pulse">
                        Loading diff...
                    </div>
                ) : diffError ? (
                    <div className="p-12 text-center">
                        <p className="text-sm font-medium text-app-text-muted italic">
                            {diffError}
                        </p>
                    </div>
                ) : parsed.error ? (
                    <div className="p-12 text-center">
                        <p className="text-sm font-medium text-app-text-muted italic">
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
                                    className="bg-app-surface-elevated border border-app-border rounded-2xl overflow-hidden shadow-app-md hover:shadow-app-lg transition-shadow"
                                >
                                    <div className="px-4 py-3 flex items-center justify-between bg-app-surface-elevated/50 border-b border-app-border">
                                        <div className="text-sm font-semibold text-app-text-main truncate">
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
                                                        );
                                                    }
                                                }}
                                                className="text-app-text-muted hover:text-app-text-main transition-colors"
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
                                        <div className="border-t border-app-border">
                                            <div className="px-4 py-4">
                                                <div className="text-[10px] font-bold text-app-text-muted uppercase tracking-[0.2em]">
                                                    AI Summary
                                                </div>
                                                {fileSummaryLoading[fileKey] ? (
                                                    <div className="space-y-2 mt-3">
                                                        <div className="h-3 bg-app-surface-elevated rounded w-[85%] animate-pulse" />
                                                        <div className="h-3 bg-app-surface-elevated rounded w-[60%] animate-pulse" />
                                                    </div>
                                                ) : fileSummaryErrors[
                                                      fileKey
                                                  ] ? (
                                                    <p className="mt-3 text-sm text-app-text-muted">
                                                        {
                                                            fileSummaryErrors[
                                                                fileKey
                                                            ]
                                                        }
                                                    </p>
                                                ) : (
                                                    <p className="mt-3 text-[14px] leading-relaxed text-app-text-main font-medium">
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
                                                    theme:
                                                        theme === "dark"
                                                            ? "dark-plus"
                                                            : "pierre-light",
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
                        <p className="text-sm font-medium text-app-text-muted italic">
                            No differences found in the current draft.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
