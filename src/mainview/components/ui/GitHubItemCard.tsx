import type { GitHubIssue, GitHubPR } from "../../../shared/types.ts";
import { openExternalUrl } from "../../rpc";
import Tooltip from "./Tooltip.tsx";

interface GitHubItemCardProps {
    item: GitHubIssue | GitHubPR;
    type: "issue" | "pr";
    variant?: "compact" | "full";
    formatTime: (dateStr: string | null) => string;
}

export default function GitHubItemCard({
    item,
    type,
    variant = "full",
    formatTime,
}: GitHubItemCardProps) {
    const isPR = type === "pr";
    const isDraft = isPR && (item as GitHubPR).draft;
    const isCompact = variant === "compact";

    return (
        <div
            className={`group bg-app-surface/40 hover:bg-app-surface/60 backdrop-blur-sm rounded-2xl ${isCompact ? "p-4" : "p-6"} border border-app-border shadow-app-sm transition-all block scroll-mt-4`}
        >
            <div className="flex items-start gap-4">
                <div
                    className={`${isCompact ? "w-8 h-8 rounded-lg" : "w-10 h-10 rounded-xl"} bg-app-bg flex items-center justify-center shrink-0 border border-app-border/20 group-hover:border-app-accent/20 transition-colors`}
                >
                    {isPR ? (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                            className={`${isCompact ? "w-4 h-4" : "w-5 h-5"} ${isDraft ? "text-app-text-muted" : "text-purple-500"} group-hover:text-app-accent transition-colors`}
                        >
                            <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
                        </svg>
                    ) : (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                            className={`${isCompact ? "w-4 h-4" : "w-5 h-5"} text-emerald-500 group-hover:text-app-accent transition-colors`}
                        >
                            <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
                            <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" />
                        </svg>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div
                        className={`flex ${isCompact ? "items-center" : "items-start"} justify-between ${isCompact ? "mb-2" : "mb-3"}`}
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <p
                                className={`${isCompact ? "text-sm truncate" : "text-base"} text-app-text-main font-bold leading-snug transition-colors`}
                            >
                                {item.title}
                            </p>
                            <Tooltip content="Open in GitHub">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        void openExternalUrl(item.url);
                                    }}
                                    className="text-app-text-muted hover:text-app-accent transition-colors shrink-0 p-1 hover:bg-app-accent/10 rounded-md block"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                        className="w-3.5 h-3.5"
                                    >
                                        <path
                                            fillRule="evenodd"
                                            d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                </button>
                            </Tooltip>
                        </div>
                        <span
                            className={`text-[10px] text-app-text-muted font-mono ${isCompact ? "opacity-60" : "bg-app-bg/50 px-2 py-1 rounded-lg border border-app-border/20"} whitespace-nowrap ml-4`}
                        >
                            {formatTime(item.createdAt)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span
                                className={`${isCompact ? "text-[10px]" : "text-xs"} text-app-text-muted font-medium tracking-tight truncate ${isCompact ? "max-w-[120px]" : ""}`}
                            >
                                {item.user}
                            </span>
                        </div>

                        <div className="flex items-center gap-4">
                            {isDraft && (
                                <div
                                    className={`flex items-center gap-1.5 ${isCompact ? "opacity-80" : "bg-app-bg/30 px-3 py-1 rounded-full border border-app-border/10"}`}
                                >
                                    <div
                                        className={`w-1.5 h-1.5 rounded-full bg-app-text-muted`}
                                    />
                                    <span
                                        className={`${isCompact ? "text-[9px] font-black" : "text-[10px] font-bold"} text-app-text-muted uppercase tracking-widest`}
                                    >
                                        Draft
                                    </span>
                                </div>
                            )}
                            <div
                                className={`${isCompact ? "text-[10px]" : "text-xs"} text-app-text-muted font-mono bg-app-bg px-2.5 py-1 rounded-lg border border-app-border/50`}
                            >
                                #{item.number}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
