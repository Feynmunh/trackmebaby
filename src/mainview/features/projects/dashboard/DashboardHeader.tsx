import type { Project } from "../../../../shared/types.ts";

interface DashboardHeaderProps {
    project: Project;
    onBack: () => void;
}

export default function DashboardHeader({
    project,
    onBack,
}: DashboardHeaderProps) {
    const hasWorktrees = project.worktrees && project.worktrees.length > 1;

    return (
        <header className="h-20 bg-mac-surface/30 backdrop-blur-md px-12 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-6">
                <button
                    onClick={onBack}
                    aria-label="Back to projects"
                    className="w-10 h-10 rounded-xl bg-mac-surface shadow-mac flex items-center justify-center hover:bg-mac-surface/80 transition-all active:scale-95 group"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        className="w-5 h-5 text-mac-accent group-hover:-translate-x-0.5 transition-transform"
                    >
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                </button>

                <div>
                    <h1 className="text-lg font-bold text-mac-text">
                        {project.name}
                    </h1>
                    <p className="text-[10px] text-mac-secondary font-mono truncate max-w-md opacity-80">
                        {project.path}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                {hasWorktrees && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 px-2.5 py-1 rounded-full border border-purple-500/20">
                        {project.worktrees.length} worktrees
                    </span>
                )}
            </div>
        </header>
    );
}
