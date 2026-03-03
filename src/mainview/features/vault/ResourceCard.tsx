/**
 * ResourceCard — Renders a single vault resource with type-specific styling
 * Supports link preview, inline editing, pin toggle, and delete
 */
import {
    ExternalLink,
    FileText,
    Lightbulb,
    Link2,
    Pencil,
    Pin,
    PinOff,
    Scale,
    Target,
    Trash2,
} from "lucide-react";
import { useCallback, useState } from "react";
import { timeAgo } from "../../../shared/time.ts";
import type {
    VaultResource,
    VaultResourceType,
} from "../../../shared/types.ts";
import { openExternalUrl } from "../../rpc.ts";

// ─── Type config ─────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
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
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface ResourceCardProps {
    resource: VaultResource;
    onTogglePin: (id: string) => void;
    onDelete: (id: string) => void;
    onEdit: (
        id: string,
        updates: {
            title?: string;
            content?: string;
            type?: VaultResourceType;
            tags?: string[];
        },
    ) => void;
}

export default function ResourceCard({
    resource,
    onTogglePin,
    onDelete,
    onEdit,
}: ResourceCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(resource.title);
    const [editContent, setEditContent] = useState(resource.content);
    const [isExpanded, setIsExpanded] = useState(false);

    const config = TYPE_CONFIG[resource.type];
    const TypeIcon = config.icon;

    const handleSaveEdit = useCallback(() => {
        onEdit(resource.id, { title: editTitle, content: editContent });
        setIsEditing(false);
    }, [resource.id, editTitle, editContent, onEdit]);

    const handleOpenLink = useCallback(() => {
        if (resource.url) {
            void openExternalUrl(resource.url);
        }
    }, [resource.url]);

    const domain = resource.url
        ? (() => {
              try {
                  return new URL(resource.url).hostname.replace("www.", "");
              } catch {
                  return resource.url;
              }
          })()
        : null;

    // ─── Edit mode ───────────────────────────────────────────────────────
    if (isEditing) {
        return (
            <div className="group rounded-2xl border border-app-accent/30 bg-app-surface/50 backdrop-blur-sm p-4 transition-all">
                <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-app-surface-elevated/50 border border-app-border rounded-lg px-3 py-2 text-[13px] text-app-text-main placeholder:text-app-text-muted/50 outline-none focus:border-app-accent/50 mb-2"
                    placeholder="Title"
                />
                <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={4}
                    className="w-full bg-app-surface-elevated/50 border border-app-border rounded-lg px-3 py-2 text-[12px] text-app-text-main placeholder:text-app-text-muted/50 outline-none focus:border-app-accent/50 resize-none mb-3"
                    placeholder="Content..."
                />
                <div className="flex items-center justify-end gap-2">
                    <button
                        onClick={() => setIsEditing(false)}
                        className="px-3 py-1.5 text-[11px] text-app-text-muted hover:text-app-text-main rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSaveEdit}
                        className="px-3 py-1.5 text-[11px] font-semibold bg-app-accent/20 text-app-accent border border-app-accent/30 rounded-lg hover:bg-app-accent/30 transition-colors"
                    >
                        Save
                    </button>
                </div>
            </div>
        );
    }

    // ─── Display mode ────────────────────────────────────────────────────
    return (
        <div
            className="group rounded-2xl border border-app-border bg-app-surface/30 backdrop-blur-sm hover:bg-app-surface/50 hover:border-app-border/80 transition-all duration-200 overflow-hidden cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
        >
            {/* Link preview image */}
            {resource.type === "link" && resource.linkPreview?.image && (
                <div className="relative w-full h-32 overflow-hidden bg-app-surface-elevated/30">
                    <img
                        src={resource.linkPreview.image}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                                "none";
                        }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-app-surface/80 to-transparent" />
                </div>
            )}

            <div className="p-4">
                {/* Type badge + pin indicator */}
                <div className="flex items-center justify-between mb-2">
                    <span
                        className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${config.bg}`}
                    >
                        <TypeIcon size={10} className={config.color} />
                        <span className={config.color}>{config.label}</span>
                    </span>
                    {resource.isPinned && (
                        <Pin
                            size={12}
                            className="text-app-accent fill-app-accent"
                        />
                    )}
                </div>

                {/* Title */}
                <h4 className="text-[13px] font-semibold text-app-text-main leading-snug mb-1 line-clamp-2">
                    {resource.title}
                </h4>

                {/* Link domain badge */}
                {resource.type === "link" && domain && (
                    <div className="flex items-center gap-1.5 mb-2">
                        {resource.linkPreview?.favicon && (
                            <img
                                src={resource.linkPreview.favicon}
                                alt=""
                                className="w-3.5 h-3.5 rounded-sm"
                                onError={(e) => {
                                    (
                                        e.target as HTMLImageElement
                                    ).style.display = "none";
                                }}
                            />
                        )}
                        <span className="text-[11px] text-blue-400/80 truncate">
                            {domain}
                        </span>
                    </div>
                )}

                {/* Content preview / link description */}
                {(resource.content || resource.linkPreview?.description) && (
                    <p
                        className={`text-[12px] text-app-text-muted leading-relaxed ${
                            isExpanded ? "" : "line-clamp-3"
                        } mb-2`}
                    >
                        {resource.type === "link" &&
                        resource.linkPreview?.description
                            ? resource.linkPreview.description
                            : resource.content}
                    </p>
                )}

                {/* Tags */}
                {resource.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                        {resource.tags.map((tag) => (
                            <span
                                key={tag}
                                className="text-[10px] px-1.5 py-0.5 rounded-md bg-app-surface-elevated/50 text-app-text-muted border border-app-border/50"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}

                {/* Footer: timestamp + actions */}
                <div className="flex items-center justify-between mt-1 pt-2 border-t border-app-border/30">
                    <span className="text-[10px] text-app-text-muted/60">
                        {timeAgo(resource.createdAt)}
                    </span>

                    {/* Action buttons — visible on hover */}
                    <div
                        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {resource.type === "link" && resource.url && (
                            <button
                                onClick={handleOpenLink}
                                className="p-1.5 rounded-lg hover:bg-app-hover transition-colors"
                                title="Open link"
                            >
                                <ExternalLink
                                    size={12}
                                    className="text-app-text-muted"
                                />
                            </button>
                        )}
                        <button
                            onClick={() => onTogglePin(resource.id)}
                            className="p-1.5 rounded-lg hover:bg-app-hover transition-colors"
                            title={resource.isPinned ? "Unpin" : "Pin to top"}
                        >
                            {resource.isPinned ? (
                                <PinOff size={12} className="text-app-accent" />
                            ) : (
                                <Pin
                                    size={12}
                                    className="text-app-text-muted"
                                />
                            )}
                        </button>
                        <button
                            onClick={() => {
                                setEditTitle(resource.title);
                                setEditContent(resource.content);
                                setIsEditing(true);
                            }}
                            className="p-1.5 rounded-lg hover:bg-app-hover transition-colors"
                            title="Edit"
                        >
                            <Pencil size={12} className="text-app-text-muted" />
                        </button>
                        <button
                            onClick={() => onDelete(resource.id)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                            title="Delete"
                        >
                            <Trash2
                                size={12}
                                className="text-app-text-muted hover:text-red-400"
                            />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
