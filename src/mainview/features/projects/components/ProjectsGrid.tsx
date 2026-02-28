import { Folder, GitBranch } from "lucide-react";
import type { GitSnapshot, Project } from "../../../../shared/types.ts";

interface ProjectsGridProps {
    projects: Project[];
    gitSnapshots: Record<string, GitSnapshot | null>;
    onOpenDashboard: (projectId: string) => void;
}

export default function ProjectsGrid({
    projects,
    gitSnapshots,
    onOpenDashboard,
}: ProjectsGridProps) {
    return (
        <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 gap-4 mt-5">
                {projects.map((project) => {
                    const snapshot = gitSnapshots[project.id];
                    const hasChanges =
                        snapshot && snapshot.uncommittedCount > 0;

                    return (
                        <button
                            key={project.id}
                            type="button"
                            onClick={() => onOpenDashboard(project.id)}
                            className="bg-mac-surface rounded-2xl p-6 border border-mac-border hover:border-white/30 transition-colors duration-150 cursor-pointer active:scale-[0.98] text-left"
                            aria-label={`Open ${project.name} dashboard`}
                        >
                            {/* Folder + name */}
                            <div className="flex items-center gap-2.5 mb-4">
                                <Folder className="w-[18px] h-[18px] text-mac-secondary shrink-0" />
                                <h3 className="text-[17px] font-semibold text-mac-text leading-tight truncate">
                                    {project.name}
                                </h3>
                            </div>

                            {/* Branch + status */}
                            {snapshot && (
                                <div className="flex items-center gap-2 mb-5 flex-wrap">
                                    <span className="inline-flex items-center gap-1.5 text-[11px] text-mac-secondary border border-mac-border bg-transparent px-2.5 py-1 rounded-[6px]">
                                        <GitBranch className="w-3 h-3 shrink-0" />
                                        <span className="max-w-[130px] truncate">
                                            {snapshot.branch}
                                        </span>
                                    </span>
                                    {hasChanges ? (
                                        <span className="text-[11px] font-bold uppercase tracking-wide bg-mac-accent/15 text-mac-accent px-2.5 py-1 rounded-[6px]">
                                            {snapshot.uncommittedCount} CHANGES
                                        </span>
                                    ) : (
                                        <span className="text-[11px] font-bold uppercase tracking-wide bg-mac-accent/10 text-mac-accent/70 px-2.5 py-1 rounded-[6px]">
                                            SYNCED
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Last commit */}
                            {snapshot?.lastCommitMessage && (
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mac-secondary mb-1">
                                        Last Commit
                                    </p>
                                    <p className="text-[13px] text-mac-text leading-snug line-clamp-1">
                                        {snapshot.lastCommitMessage}
                                    </p>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
