/**
 * ResourceCard — Renders a single vault resource with type-specific styling
 * Supports link preview, inline editing, pin toggle, and delete
 */
import {
    ExternalLink,
    Eye,
    ImageIcon,
    Link2,
    Pencil,
    Pin,
    PinOff,
    Trash2,
} from "lucide-react";
import type { SyntheticEvent } from "react";
import { useCallback, useState } from "react";
import { timeAgo } from "../../../shared/time.ts";
import type {
    VaultResource,
    VaultResourceType,
} from "../../../shared/types.ts";
import { openExternalUrl } from "../../rpc.ts";
import { TYPE_CONFIG, TYPE_OPTIONS } from "./constants.ts";

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
        },
    ) => void;
    onViewDetails?: (resource: VaultResource) => void;
}

export default function ResourceCard({
    resource,
    onTogglePin,
    onDelete,
    onEdit,
    onViewDetails,
}: ResourceCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(resource.title);
    const [editContent, setEditContent] = useState(resource.content);
    const [editType, setEditType] = useState<VaultResourceType>(resource.type);
    const [faviconFailed, setFaviconFailed] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [aspectRatio, setAspectRatio] = useState<"square" | "wide" | "tall">(
        "square",
    );

    const config = TYPE_CONFIG[resource.type];
    const TypeIcon = config.icon;

    const handleSaveEdit = useCallback(() => {
        onEdit(resource.id, {
            title: editTitle,
            content: editContent,
            type: editType,
        });
        setIsEditing(false);
    }, [resource.id, editTitle, editContent, editType, onEdit]);

    const handleOpenLink = useCallback(() => {
        if (resource.url) {
            void openExternalUrl(resource.url);
        }
    }, [resource.url]);

    const handleImageLoad = (e: SyntheticEvent<HTMLImageElement>) => {
        const { naturalWidth, naturalHeight } = e.currentTarget;
        const ratio = naturalWidth / naturalHeight;
        if (ratio > 1.5) {
            setAspectRatio("wide");
        } else if (ratio < 0.7) {
            setAspectRatio("tall");
        } else {
            setAspectRatio("square");
        }
    };

    const domain = resource.url
        ? (() => {
              try {
                  return new URL(resource.url).hostname.replace("www.", "");
              } catch {
                  return resource.url;
              }
          })()
        : null;

    // ─── Grid Spans ──────────────────────────────────────────────────────
    let gridSpan = "col-span-2 row-span-3"; // Standard base size (approx 120px height)

    if (resource.type === "image") {
        if (aspectRatio === "wide") {
            gridSpan = "col-span-4 row-span-4";
        } else if (aspectRatio === "tall") {
            gridSpan = "col-span-2 row-span-6";
        } else {
            gridSpan = "col-span-2 row-span-4";
        }
    } else if (resource.type === "link") {
        if (resource.linkPreview?.image) {
            gridSpan = "col-span-4 row-span-5";
        } else {
            gridSpan = "col-span-2 row-span-2";
        }
    } else if (resource.type === "note" || resource.type === "idea") {
        if (resource.content && resource.content.length > 300) {
            gridSpan = "col-span-4 row-span-5";
        } else if (resource.content && resource.content.length > 150) {
            gridSpan = "col-span-2 row-span-4";
        }
    } else if (resource.type === "blocker") {
        gridSpan = "col-span-4 row-span-3";
    }

    // ─── Edit mode ───────────────────────────────────────────────────────
    if (isEditing) {
        return (
            <div
                className={`group rounded-2xl border border-app-accent/30 bg-app-surface/50 backdrop-blur-sm p-4 transition-all h-full ${gridSpan}`}
            >
                {/* Category Selector */}
                <div className="flex items-center gap-1.5 mb-3 overflow-x-auto scrollbar-none pb-1">
                    {TYPE_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        const isSelected = editType === opt.type;
                        return (
                            <button
                                key={opt.type}
                                onClick={() => setEditType(opt.type)}
                                className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border whitespace-nowrap ${
                                    isSelected
                                        ? `${opt.bg} ${opt.color} border-current/20`
                                        : "text-app-text-muted/40 border-transparent hover:bg-app-surface-elevated/50"
                                }`}
                            >
                                <Icon size={11} />
                                {opt.label}
                            </button>
                        );
                    })}
                </div>

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

    // ─── Compact link card ──────────────────────────────────────────────
    const siteName =
        resource.linkPreview?.siteName ||
        resource.linkPreview?.title ||
        domain ||
        resource.title;

    if (resource.type === "link") {
        return (
            <div
                className={`group relative flex flex-col rounded-2xl border border-app-border bg-app-surface/30 backdrop-blur-sm hover:bg-app-surface/50 hover:border-app-border/80 transition-all duration-300 overflow-hidden h-full ${gridSpan}`}
            >
                {/* OG preview image (Large) */}
                {resource.linkPreview?.image && (
                    <div className="relative w-full aspect-video overflow-hidden bg-app-surface-elevated/30">
                        <img
                            src={resource.linkPreview.image}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                    "none";
                            }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
                    </div>
                )}

                <div className="flex-1 flex flex-col p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="shrink-0 w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/15 flex items-center justify-center">
                                {resource.linkPreview?.favicon &&
                                !faviconFailed ? (
                                    <img
                                        src={resource.linkPreview.favicon}
                                        alt=""
                                        className="w-3.5 h-3.5 rounded-sm"
                                        onError={() => setFaviconFailed(true)}
                                    />
                                ) : (
                                    <Link2
                                        size={12}
                                        className="text-blue-400"
                                    />
                                )}
                            </div>
                            <h4 className="text-[13px] font-bold text-app-text-main truncate">
                                {domain || siteName}
                            </h4>
                        </div>
                        {resource.isPinned && (
                            <Pin
                                size={11}
                                className="text-app-accent fill-app-accent shrink-0 mt-1"
                            />
                        )}
                    </div>

                    {/* URL and Description */}
                    <div className="space-y-2 mb-3">
                        <p className="text-[11px] text-blue-400 font-mono break-all line-clamp-2">
                            {resource.url}
                        </p>
                        {(resource.linkPreview?.description ||
                            resource.content) && (
                            <p
                                className={`text-[11px] text-app-text-muted/80 leading-relaxed ${resource.linkPreview?.image ? "line-clamp-2" : "line-clamp-4"}`}
                            >
                                {resource.linkPreview?.description ||
                                    resource.content}
                            </p>
                        )}
                    </div>

                    <div className="mt-auto flex items-center justify-between">
                        <span className="text-[9px] text-app-text-muted/40 font-medium">
                            {siteName}
                        </span>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={handleOpenLink}
                                className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-400 transition-colors"
                                title="Open link"
                            >
                                <ExternalLink size={12} />
                            </button>
                            <button
                                onClick={() => onTogglePin(resource.id)}
                                className="p-1.5 rounded-lg hover:bg-app-hover transition-colors"
                            >
                                {resource.isPinned ? (
                                    <PinOff
                                        size={12}
                                        className="text-app-accent"
                                    />
                                ) : (
                                    <Pin
                                        size={12}
                                        className="text-app-text-muted"
                                    />
                                )}
                            </button>
                            <button
                                onClick={() => onViewDetails?.(resource)}
                                className="p-1.5 rounded-lg hover:bg-app-accent/10 text-app-text-muted hover:text-app-accent transition-colors"
                                title="Full details"
                            >
                                <Eye size={12} />
                            </button>
                            <button
                                onClick={() => setIsEditing(true)}
                                className="p-1.5 rounded-lg hover:bg-app-hover transition-colors"
                            >
                                <Pencil
                                    size={12}
                                    className="text-app-text-muted"
                                />
                            </button>
                            <button
                                onClick={() => onDelete(resource.id)}
                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Image card ──────────────────────────────────────────────────────
    if (resource.type === "image") {
        const imageUrl = resource.url || "";
        const hasValidImage =
            imageUrl.startsWith("http://") ||
            imageUrl.startsWith("https://") ||
            imageUrl.startsWith("data:image/");

        return (
            <div
                className={`group relative rounded-2xl border border-app-border bg-app-surface/30 backdrop-blur-sm hover:bg-app-surface/50 hover:border-app-border/80 transition-all duration-300 overflow-hidden h-full ${gridSpan}`}
            >
                {/* Full Image */}
                <div
                    className={`relative w-full ${aspectRatio === "tall" ? "h-full" : "aspect-video md:aspect-auto h-full min-h-[160px]"} bg-app-surface-elevated/30 overflow-hidden`}
                >
                    {hasValidImage && !imageError ? (
                        <img
                            src={imageUrl}
                            alt={resource.title}
                            onLoad={handleImageLoad}
                            className="w-full h-full object-cover"
                            onError={() => setImageError(true)}
                        />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-app-text-muted/20">
                            <ImageIcon size={32} />
                            <span className="text-[10px]">
                                {imageError
                                    ? "Image failed to load"
                                    : "No image"}
                            </span>
                        </div>
                    )}

                    {/* Overlay info */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                        <div className="flex items-center justify-between gap-3">
                            <h4 className="text-[12px] font-bold text-white truncate">
                                {resource.title}
                            </h4>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => onTogglePin(resource.id)}
                                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                                >
                                    {resource.isPinned ? (
                                        <PinOff
                                            size={12}
                                            className="text-app-accent"
                                        />
                                    ) : (
                                        <Pin size={12} />
                                    )}
                                </button>
                                <button
                                    onClick={() => onViewDetails?.(resource)}
                                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                                    title="Full details"
                                >
                                    <Eye size={12} />
                                </button>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                                >
                                    <Pencil size={12} />
                                </button>
                                <button
                                    onClick={() => onDelete(resource.id)}
                                    className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-200 transition-colors"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Permanent Pin Indicator */}
                    {resource.isPinned && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                            <Pin
                                size={10}
                                className="text-app-accent fill-app-accent"
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ─── Standard card (note, milestone, idea, decision) ─────────────────
    return (
        <div
            className={`group flex flex-col rounded-2xl border border-app-border bg-app-surface/30 backdrop-blur-sm hover:bg-app-surface/50 hover:border-app-border/80 transition-all duration-200 overflow-hidden h-full ${gridSpan}`}
        >
            <div className="flex-1 p-4 flex flex-col">
                {/* Type badge + pin indicator */}
                <div className="flex items-center justify-between mb-3">
                    <span
                        className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-full border ${config.bg}`}
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
                <h4 className="text-[13px] font-bold text-app-text-main leading-snug mb-2 group-hover:text-app-accent transition-colors">
                    {resource.title}
                </h4>

                {/* Content preview */}
                {resource.content && (
                    <p className="text-[12px] text-app-text-muted/80 leading-relaxed line-clamp-[8] mb-4">
                        {resource.content}
                    </p>
                )}

                {/* Footer: timestamp + actions */}
                <div className="mt-auto flex items-center justify-between pt-3 border-t border-app-border/30">
                    <span className="text-[9px] font-medium text-app-text-muted/40 uppercase tracking-wider">
                        {timeAgo(resource.createdAt)}
                    </span>

                    {/* Action buttons — visible on hover */}
                    <div
                        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => onTogglePin(resource.id)}
                            className="p-1.5 rounded-lg hover:bg-app-hover transition-colors"
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
                            onClick={() => onViewDetails?.(resource)}
                            className="p-1.5 rounded-lg hover:bg-app-accent/10 transition-colors"
                            title="Full details"
                        >
                            <Eye
                                size={12}
                                className="text-app-text-muted hover:text-app-accent"
                            />
                        </button>
                        <button
                            onClick={() => setIsEditing(true)}
                            className="p-1.5 rounded-lg hover:bg-app-hover transition-colors"
                        >
                            <Pencil size={12} className="text-app-text-muted" />
                        </button>
                        <button
                            onClick={() => onDelete(resource.id)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
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
