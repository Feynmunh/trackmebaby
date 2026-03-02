import { Bot, Code2, Database } from "lucide-react";
import type { Project } from "../../../../shared/types.ts";
import PillDock from "./PillDock.tsx";

interface DashboardHeaderProps {
    project: Project;
    onBack: () => void;
    activeView?: "overview" | "warden";
    onViewChange?: (view: "overview" | "warden") => void;
}

export default function DashboardHeader({
    project,
    onBack,
    activeView = "overview",
    onViewChange,
}: DashboardHeaderProps) {
    const hasWorktrees = project.worktrees && project.worktrees.length > 1;

    return (
        <header className="h-28 bg-mac-surface/30 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
            {/* Left — back + name */}
            <div className="flex items-center gap-4 min-w-[180px]">
                <button
                    onClick={onBack}
                    aria-label="Back to projects"
                    className="w-9 h-9 rounded-xl bg-mac-surface shadow-mac flex items-center justify-center hover:bg-mac-surface/80 transition-all active:scale-95 group shrink-0"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        className="w-4 h-4 text-mac-accent group-hover:-translate-x-0.5 transition-transform"
                    >
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                </button>
                <h1 className="text-[15px] font-bold text-mac-text truncate">
                    {project.name}
                </h1>
            </div>

            {/* Right — pill dock + badges */}
            <div className="flex items-end gap-4 min-w-[180px] justify-end pb-5">
                {hasWorktrees && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 px-2.5 py-1 rounded-full border border-purple-500/20">
                        {project.worktrees.length} worktrees
                    </span>
                )}
                <PillDock
                    baseItemSize={34}
                    magnification={50}
                    distance={130}
                    items={[
                        {
                            icon: <Code2 size={15} strokeWidth={2.2} />,
                            label: "Code",
                            isActive: activeView === "overview",
                            onClick: () => onViewChange?.("overview"),
                        },
                        {
                            icon: <Database size={15} strokeWidth={2} />,
                            label: "Resource Vault",
                            disabled: true,
                            separator: true,
                        },
                        {
                            icon: <Bot size={15} strokeWidth={2} />,
                            label: "Warden",
                            isActive: activeView === "warden",
                            onClick: () => onViewChange?.("warden"),
                            separator: true,
                        },
                    ]}
                />
            </div>
        </header>
    );
}
