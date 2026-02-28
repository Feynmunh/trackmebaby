import { timeAgo } from "../../../../shared/time.ts";
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
            <header className="mb-10 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-mac-text">
                        Projects
                    </h1>
                    <p className="text-mac-secondary text-sm mt-1">
                        Select a project for details
                    </p>
                </div>
                <div className="text-xs font-medium text-mac-secondary bg-mac-surface px-3 py-1.5 rounded-full shadow-mac-sm">
                    {projects.length} PROJECTS
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => {
                    const snapshot = gitSnapshots[project.id];
                    return (
                        <div
                            key={project.id}
                            onClick={() => onOpenDashboard(project.id)}
                            className="bg-mac-surface rounded-2xl p-6 shadow-mac border border-mac-border hover:shadow-mac-md transition-all duration-200 cursor-pointer group active:scale-[0.98]"
                        >
                            <h3 className="text-lg font-semibold text-mac-text mb-4 group-hover:text-mac-accent transition-colors">
                                {project.name}
                            </h3>
                            {snapshot && (
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {snapshot.uncommittedCount > 0 ? (
                                        <span className="text-[10px] font-bold uppercase tracking-wider bg-mac-accent/10 text-mac-accent px-2 py-0.5 rounded border border-mac-accent/20">
                                            {snapshot.uncommittedCount} changes
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold uppercase tracking-wider bg-mac-bg text-mac-secondary px-2 py-0.5 rounded border border-mac-border">
                                            0 changes
                                        </span>
                                    )}
                                    {project.worktrees &&
                                        project.worktrees.length > 1 && (
                                            <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded border border-purple-500/20">
                                                {project.worktrees.length}{" "}
                                                worktrees
                                            </span>
                                        )}
                                </div>
                            )}

                            <div className="mt-auto pt-4 border-t border-mac-border flex items-center justify-between">
                                <span className="text-xs text-mac-secondary">
                                    {project.lastActivityAt
                                        ? timeAgo(project.lastActivityAt, {
                                              emptyLabel: "Never active",
                                              justNowLabel: "Just now",
                                              maxDays: Number.POSITIVE_INFINITY,
                                          })
                                        : "Never active"}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
