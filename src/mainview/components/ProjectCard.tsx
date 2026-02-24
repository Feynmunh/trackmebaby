import type { Project, GitSnapshot } from "../../shared/types.ts";

interface ProjectCardProps {
    project: Project;
    gitSnapshot?: GitSnapshot | null;
    recentFiles?: string[];
}

export default function ProjectCard({
    project,
    gitSnapshot,
    recentFiles = [],
}: ProjectCardProps) {
    const projectPathParts = project.path.split('/');

    return (
        <div className="bg-mac-surface rounded-xl p-5 shadow-mac hover:shadow-mac-md transition-all duration-200 hover:scale-[1.01] group cursor-pointer flex flex-col h-full">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-mac bg-mac-bg flex items-center justify-center shrink-0 group-hover:bg-mac-accent group-hover:text-white text-mac-secondary transition-all duration-200">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-[15px] font-semibold text-mac-text truncate leading-tight">
                            {project.name}
                        </h3>
                        <p className="text-xs text-mac-secondary truncate mt-0.5" title={project.path}>
                            {projectPathParts.length > 2 ? `.../${projectPathParts.slice(-2).join('/')}` : projectPathParts.join('/')}
                        </p>
                    </div>
                </div>
                {/* Status dot */}
                <div className="w-2 h-2 rounded-full bg-[#34C759] shadow-[0_0_6px_rgba(52,199,89,0.4)] mt-2" />
            </div>

            {/* Git Info */}
            <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                    {gitSnapshot && (
                        <>
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-mac-bg text-xs font-medium text-mac-secondary">
                                <span className="w-1.5 h-1.5 rounded-full bg-mac-accent" />
                                {gitSnapshot.branch}
                            </span>
                            {gitSnapshot.uncommittedCount > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-mac-bg text-xs font-medium text-mac-secondary">
                                    {gitSnapshot.uncommittedCount} pending
                                </span>
                            )}
                        </>
                    )}
                </div>

                {/* Last commit */}
                {gitSnapshot?.lastCommitMessage && (
                    <div className="mb-3">
                        <div className="bg-mac-bg rounded-lg p-2.5 flex items-start gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-mac-secondary mt-0.5 shrink-0">
                                <path fillRule="evenodd" d="M11.986 3H12a2 2 0 0 1 2 2v6a2 2 0 0 1-1.5 1.937V7A2.5 2.5 0 0 0 10 4.5H4.063A2 2 0 0 1 6 3h.014A2.25 2.25 0 0 1 8.25 1h.5a2.25 2.25 0 0 1 2.236 2ZM10.5 4v-.75a.75.75 0 0 0-.75-.75h-3.5a.75.75 0 0 0-.75.75V4h5Z" clipRule="evenodd" />
                                <path fillRule="evenodd" d="M2 7a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7Z" clipRule="evenodd" />
                            </svg>
                            <p className="text-xs text-mac-secondary leading-relaxed line-clamp-2">
                                {gitSnapshot.lastCommitMessage}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Recent files */}
            {recentFiles.length > 0 && (
                <div className="mt-auto border-t border-mac-border pt-3">
                    <h4 className="text-[11px] font-medium text-mac-secondary uppercase tracking-wider mb-1.5">Recent</h4>
                    <div className="space-y-0.5">
                        {recentFiles.slice(0, 3).map((file, i) => (
                            <div key={i} className="flex items-center gap-2 px-1.5 py-1 -mx-1.5 hover:bg-mac-hover rounded-md transition-colors cursor-default">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-mac-secondary shrink-0">
                                    <path d="M4 2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.414A2 2 0 0 0 13.414 6L10 2.586A2 2 0 0 0 8.586 2H4Z" />
                                </svg>
                                <span className="text-[12px] text-mac-secondary truncate">{file}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
