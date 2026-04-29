import { Folder, GitBranch, Trash2 } from "lucide-react";
import { useState } from "react";
import type { GitSnapshot, Project } from "../../../../shared/types.ts";

interface ProjectsGridProps {
    projects: Project[];
    gitSnapshots: Record<string, GitSnapshot | null>;
    onOpenDashboard: (projectId: string) => void;
    onDeleteProject: (projectId: string) => void;
}

export default function ProjectsGrid({
    projects,
    gitSnapshots,
    onOpenDashboard,
    onDeleteProject,
}: ProjectsGridProps) {
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    return (
        <div className="max-w-6xl mx-auto pb-4">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 mt-4">
                {projects.map((project) => {
                    const snapshot = gitSnapshots[project.id];
                    const hasChanges =
                        snapshot && snapshot.uncommittedCount > 0;

                    return (
                        <article
                            key={project.id}
                            className="relative bg-app-surface rounded-[14px] border border-app-border hover:border-app-text-muted/30 transition-colors duration-150 active:scale-[0.98] text-left group"
                        >
                            {/* Delete controls — outside the clickable card area */}
                            {confirmingId === project.id ? (
                                <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onDeleteProject(project.id);
                                            setConfirmingId(null);
                                        }}
                                        className="text-[10px] font-semibold bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded transition-colors shadow-sm"
                                    >
                                        Confirm
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmingId(null)}
                                        className="text-[10px] font-semibold bg-app-surface hover:bg-app-border text-app-text-muted px-2 py-1 rounded border border-app-border transition-colors shadow-sm"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setConfirmingId(project.id)}
                                    className="absolute top-2 right-2 p-1.5 rounded-md text-app-text-muted/60 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition-all z-10"
                                    aria-label={`Delete ${project.name}`}
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                            {/* Card body — the main clickable area */}
                            <button
                                type="button"
                                className="w-full p-4 text-left cursor-pointer"
                                onClick={() => onOpenDashboard(project.id)}
                                aria-label={`Open ${project.name} dashboard`}
                            >
                                {/* Folder + name */}
                                <div className="flex items-center gap-2 mb-3 mr-6">
                                    <Folder className="w-[15px] h-[15px] text-app-text-muted shrink-0" />
                                    <h3 className="text-[14px] font-semibold text-app-text-main leading-tight truncate">
                                        {project.name}
                                    </h3>
                                </div>

                                {/* Branch + status */}
                                {snapshot && (
                                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                                        <span className="inline-flex items-center gap-1 text-[10px] text-app-text-muted border border-app-border bg-transparent px-2 py-0.5 rounded-[5px]">
                                            <GitBranch className="w-2.5 h-2.5 shrink-0 opacity-70" />
                                            <span className="max-w-[90px] truncate">
                                                {snapshot.branch}
                                            </span>
                                        </span>
                                        {hasChanges ? (
                                            <span className="text-[9px] font-bold uppercase tracking-wider bg-app-accent/15 text-app-accent px-2 py-0.5 rounded-[5px]">
                                                {snapshot.uncommittedCount}{" "}
                                                CHANGES
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-bold uppercase tracking-wider bg-app-success/15 text-app-success px-2 py-0.5 rounded-[5px]">
                                                SYNCED
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Last commit */}
                                {snapshot?.lastCommitMessage && (
                                    <div>
                                        <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-app-text-muted/80 mb-0.5">
                                            Last Commit
                                        </p>
                                        <p className="text-[12px] text-app-text-main/90 leading-snug line-clamp-1">
                                            {snapshot.lastCommitMessage}
                                        </p>
                                    </div>
                                )}
                            </button>
                        </article>
                    );
                })}
            </div>
        </div>
    );
}
