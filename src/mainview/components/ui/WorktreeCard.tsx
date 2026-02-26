import type { Worktree } from "../../../shared/types.ts";

function formatWorktreeActivity(dateStr: string | null): string {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
}

interface WorktreeCardProps {
    worktree: Worktree;
}

export default function WorktreeCard({ worktree }: WorktreeCardProps) {
    const isActive = worktree.uncommittedCount > 0;

    return (
        <div
            className={`
            flex-shrink-0 min-w-[200px] max-w-[280px] rounded-xl px-4 py-3
            border transition-all duration-200
            ${
                isActive
                    ? "bg-mac-accent/5 border-mac-accent/30 shadow-mac-sm"
                    : "bg-mac-surface/50 border-mac-border/30"
            }
        `}
        >
            <div className="flex items-center gap-2 mb-1.5">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    className="w-3.5 h-3.5 text-mac-accent flex-shrink-0"
                >
                    <path d="M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                    <path d="M18 9c0 6-12 6-12 12" />
                </svg>
                <span className="text-xs font-semibold text-mac-text truncate">
                    {worktree.branch}
                </span>
                {worktree.isMain && (
                    <span className="text-[8px] font-bold uppercase tracking-wider text-mac-secondary bg-mac-bg px-1.5 py-0.5 rounded">
                        main
                    </span>
                )}
            </div>

            <div className="flex items-center justify-between">
                <span className="text-[10px] text-mac-secondary">
                    {formatWorktreeActivity(worktree.lastActivityAt)}
                </span>
                {isActive && (
                    <span className="text-[10px] font-semibold text-mac-accent">
                        {worktree.uncommittedCount} changes
                    </span>
                )}
            </div>
        </div>
    );
}
