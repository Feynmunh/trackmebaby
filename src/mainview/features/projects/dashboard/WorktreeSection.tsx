import type { Worktree } from "../../../../shared/types.ts";
import WorktreeCard from "../../../components/ui/WorktreeCard.tsx";

interface WorktreeSectionProps {
    worktrees: Worktree[];
}

export default function WorktreeSection({ worktrees }: WorktreeSectionProps) {
    if (!worktrees || worktrees.length <= 1) {
        return null;
    }

    return (
        <div className="bg-app-surface/20 px-12 py-4 shrink-0">
            <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-1">
                {worktrees.map((worktree) => (
                    <WorktreeCard key={worktree.path} worktree={worktree} />
                ))}
            </div>
        </div>
    );
}
