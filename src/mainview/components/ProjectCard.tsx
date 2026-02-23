import type { Project, GitSnapshot } from "../../shared/types.ts";

interface ProjectCardProps {
    project: Project;
    gitSnapshot?: GitSnapshot | null;
    recentFiles?: string[];
}

function formatRelativeTime(dateStr: string | null): string {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

export default function ProjectCard({
    project,
    gitSnapshot,
    recentFiles = [],
}: ProjectCardProps) {
    const hasUncommitted = (gitSnapshot?.uncommittedCount ?? 0) > 0;

    return (
        <div className="bg-gray-900/80 rounded-2xl border border-gray-800/60 p-5 hover:border-gray-700/60 transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/5 group">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate group-hover:text-violet-300 transition-colors">
                        {project.name}
                    </h3>
                    <p className="text-xs text-gray-500 truncate mt-0.5" title={project.path}>
                        {project.path.replace(/^\/home\/[^/]+\//, "~/")}
                    </p>
                </div>
                <span className="text-[10px] text-gray-500 whitespace-nowrap ml-2">
                    {formatRelativeTime(project.lastActivityAt)}
                </span>
            </div>

            {/* Git Info */}
            {gitSnapshot && (
                <div className="flex items-center gap-2 mb-3">
                    {/* Branch */}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-800 text-xs text-gray-300">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                            className="w-3 h-3 text-gray-500"
                        >
                            <path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.5 2.5 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Z" />
                        </svg>
                        {gitSnapshot.branch}
                    </span>

                    {/* Uncommitted badge */}
                    {hasUncommitted && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-xs text-amber-400 border border-amber-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            {gitSnapshot.uncommittedCount} uncommitted
                        </span>
                    )}
                </div>
            )}

            {/* Last commit */}
            {gitSnapshot?.lastCommitMessage && (
                <div className="mb-3 px-2.5 py-1.5 rounded-lg bg-gray-800/50 border border-gray-800">
                    <p className="text-xs text-gray-400 truncate">
                        <span className="text-gray-500 font-mono">
                            {gitSnapshot.lastCommitHash?.substring(0, 7)}
                        </span>{" "}
                        {gitSnapshot.lastCommitMessage}
                    </p>
                </div>
            )}

            {/* Recent files */}
            {recentFiles.length > 0 && (
                <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-gray-600 font-medium">
                        Recent files
                    </p>
                    {recentFiles.slice(0, 3).map((file) => (
                        <p
                            key={file}
                            className="text-xs text-gray-500 truncate font-mono"
                            title={file}
                        >
                            {file}
                        </p>
                    ))}
                </div>
            )}
        </div>
    );
}
