/**
 * Shared constants for the Resource Vault feature
 */
import {
    FileText,
    ImageIcon,
    Lightbulb,
    Link2,
    Scale,
    ShieldAlert,
    Target,
} from "lucide-react";
import type { VaultResourceType } from "../../../shared/types.ts";

export const TYPE_CONFIG: Record<
    VaultResourceType,
    { icon: typeof Link2; label: string; color: string; bg: string }
> = {
    link: {
        icon: Link2,
        label: "Link",
        color: "text-blue-400",
        bg: "bg-blue-500/10 border-blue-500/20",
    },
    note: {
        icon: FileText,
        label: "Note",
        color: "text-emerald-400",
        bg: "bg-emerald-500/10 border-emerald-500/20",
    },
    milestone: {
        icon: Target,
        label: "Milestone",
        color: "text-amber-400",
        bg: "bg-amber-500/10 border-amber-500/20",
    },
    idea: {
        icon: Lightbulb,
        label: "Idea",
        color: "text-purple-400",
        bg: "bg-purple-500/10 border-purple-500/20",
    },
    decision: {
        icon: Scale,
        label: "Decision",
        color: "text-rose-400",
        bg: "bg-rose-500/10 border-rose-500/20",
    },
    image: {
        icon: ImageIcon,
        label: "Image",
        color: "text-cyan-400",
        bg: "bg-cyan-500/10 border-cyan-500/20",
    },
    blocker: {
        icon: ShieldAlert,
        label: "Blocker",
        color: "text-orange-400",
        bg: "bg-orange-500/10 border-orange-500/20",
    },
};

export const TYPE_OPTIONS = (
    Object.keys(TYPE_CONFIG) as VaultResourceType[]
).map((type) => ({
    type,
    ...TYPE_CONFIG[type],
}));

/** Labels for type-specific empty states */
export const TYPE_EMPTY_LABELS: Record<VaultResourceType, string> = {
    link: "You haven't saved any links yet",
    note: "You haven't created any notes yet",
    milestone: "You haven't created any milestones yet",
    idea: "You haven't captured any ideas yet",
    decision: "You haven't recorded any decisions yet",
    image: "You haven't added any images yet",
    blocker: "You haven't reported any blockers yet",
};
