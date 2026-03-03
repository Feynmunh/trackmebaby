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
        <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 gap-4 mt-5">
                {projects.map((project) => {
                    const snapshot = gitSnapshots[project.id];
                    const hasChanges =
                        snapshot && snapshot.uncommittedCount > 0;

                    return (
                        <article
                            key={project.id}
                            className="relative bg-mac-surface rounded-2xl border border-mac-border hover:border-white/30 transition-colors duration-150 active:scale-[0.98] text-left group"
                        >
                            {/* Delete controls — outside the clickable card area */}
                            {confirmingId === project.id ? (
                                <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onDeleteProject(project.id);
                                            setConfirmingId(null);
                                        }}
                                        className="text-[11px] font-semibold bg-red-500 hover:bg-red-600 text-white px-2.5 py-1 rounded-lg transition-colors"
                                    >
                                        Confirm
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmingId(null)}
                                        className="text-[11px] font-semibold bg-mac-surface hover:bg-mac-border text-mac-secondary px-2.5 py-1 rounded-lg border border-mac-border transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setConfirmingId(project.id)}
                                    className="absolute top-3 right-3 p-1.5 rounded-lg text-mac-secondary hover:text-red-400 hover:bg-red-500/10 transition-all z-10"
                                    aria-label={`Delete ${project.name}`}
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                            {/* Card body — the main clickable area */}
                            <button
                                type="button"
                                className="w-full p-6 text-left cursor-pointer"
                                onClick={() => onOpenDashboard(project.id)}
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
                                                {snapshot.uncommittedCount}{" "}
                                                CHANGES
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
                        </article>
                    );
                })}
            </div>
        </div>
    );
}
