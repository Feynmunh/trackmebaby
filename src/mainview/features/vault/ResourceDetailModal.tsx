/**
 * ResourceDetailModal — Full-detail overlay for a vault resource
 * Opens when the user clicks any card in the resource vault.
 */
import {
    Calendar,
    Clock,
    ExternalLink,
    ImageIcon,
    Link2,
    Pencil,
    Pin,
    PinOff,
    Trash2,
    X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { timeAgo } from "../../../shared/time.ts";
import type {
    VaultResource,
    VaultResourceType,
} from "../../../shared/types.ts";
import { openExternalUrl } from "../../rpc.ts";
import { TYPE_CONFIG, TYPE_OPTIONS } from "./constants.ts";

interface ResourceDetailModalProps {
    resource: VaultResource;
    onClose: () => void;
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
}

export default function ResourceDetailModal({
    resource,
    onClose,
    onTogglePin,
    onDelete,
    onEdit,
}: ResourceDetailModalProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(resource.title);
    const [editContent, setEditContent] = useState(resource.content);
    const [editType, setEditType] = useState<VaultResourceType>(resource.type);
    const panelRef = useRef<HTMLDivElement>(null);

    const config = TYPE_CONFIG[resource.type];
    const TypeIcon = config.icon;

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);

    // Close when clicking the backdrop
    const handleBackdropClick = useCallback(
        (e: React.MouseEvent) => {
            if (
                panelRef.current &&
                !panelRef.current.contains(e.target as Node)
            ) {
                onClose();
            }
        },
        [onClose],
    );

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

    const imageUrl = resource.url || "";
    const hasValidImage =
        resource.type === "image" &&
        (imageUrl.startsWith("http://") ||
            imageUrl.startsWith("https://") ||
            imageUrl.startsWith("data:image/"));

    const createdDate = new Date(resource.createdAt).toLocaleDateString(
        "en-US",
        { month: "short", day: "numeric", year: "numeric" },
    );
    const createdTime = new Date(resource.createdAt).toLocaleTimeString(
        "en-US",
        { hour: "numeric", minute: "2-digit" },
    );

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={handleBackdropClick}
        >
            <div
                ref={panelRef}
                className="relative w-full max-h-[85vh] bg-app-bg border-t border-app-border/40 rounded-t-3xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-200"
            >
                {/* ── Drag handle ── */}
                <div className="flex items-center justify-center pt-3 pb-1 shrink-0">
                    <div className="w-10 h-1 rounded-full bg-app-text-muted/20" />
                </div>

                {/* ── Header bar ── */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-app-border/20 shrink-0">
                    <div className="flex items-center gap-2.5">
                        {isEditing ? (
                            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                                {TYPE_OPTIONS.map((opt) => {
                                    const Icon = opt.icon;
                                    const isSelected = editType === opt.type;
                                    return (
                                        <button
                                            key={opt.type}
                                            onClick={() =>
                                                setEditType(opt.type)
                                            }
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border whitespace-nowrap ${
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
                        ) : (
                            <>
                                <span
                                    className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${config.bg}`}
                                >
                                    <TypeIcon
                                        size={11}
                                        className={config.color}
                                    />
                                    <span className={config.color}>
                                        {config.label}
                                    </span>
                                </span>
                                {resource.isPinned && (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-app-accent font-semibold">
                                        <Pin
                                            size={10}
                                            className="fill-app-accent"
                                        />
                                        Pinned
                                    </span>
                                )}
                            </>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-app-surface-elevated/50 border border-app-border/30 flex items-center justify-center hover:bg-app-surface-elevated transition-colors"
                    >
                        <X size={14} className="text-app-text-muted" />
                    </button>
                </div>

                {/* ── Scrollable content ── */}
                <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">
                    {/* Image (for image type) */}
                    {resource.type === "image" && (
                        <div className="relative rounded-2xl overflow-hidden bg-app-surface-elevated/20 border border-app-border/20">
                            {hasValidImage ? (
                                <>
                                    <img
                                        src={imageUrl}
                                        alt={resource.title}
                                        className="w-full h-auto max-h-[50vh] object-contain bg-black/20"
                                        onError={(e) => {
                                            const el =
                                                e.target as HTMLImageElement;
                                            el.style.display = "none";
                                            const fb = el.nextElementSibling;
                                            if (fb)
                                                (
                                                    fb as HTMLElement
                                                ).style.display = "flex";
                                        }}
                                    />
                                    <div
                                        className="w-full h-48 flex-col items-center justify-center gap-2 text-app-text-muted/40"
                                        style={{ display: "none" }}
                                    >
                                        <ImageIcon size={32} />
                                        <span className="text-[11px]">
                                            Failed to load image
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <div className="w-full h-48 flex flex-col items-center justify-center gap-2 text-app-text-muted/30">
                                    <ImageIcon size={36} />
                                    <span className="text-[11px]">
                                        No image available
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Link preview image */}
                    {resource.type === "link" &&
                        resource.linkPreview?.image && (
                            <div className="relative rounded-2xl overflow-hidden bg-app-surface-elevated/20 border border-app-border/20">
                                <img
                                    src={resource.linkPreview.image}
                                    alt=""
                                    className="w-full h-auto max-h-[40vh] object-cover"
                                    onError={(e) => {
                                        (
                                            e.target as HTMLImageElement
                                        ).style.display = "none";
                                    }}
                                />
                            </div>
                        )}

                    {/* Title */}
                    {isEditing ? (
                        <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full bg-app-surface-elevated/50 border border-app-border rounded-xl px-4 py-2.5 text-[15px] font-bold text-app-text-main placeholder:text-app-text-muted/50 outline-none focus:border-app-accent/50"
                            placeholder="Title"
                        />
                    ) : (
                        <h2 className="text-[17px] font-bold text-app-text-main leading-snug">
                            {resource.title}
                        </h2>
                    )}

                    {/* URL section (links) */}
                    {resource.type === "link" && resource.url && (
                        <div className="flex items-center gap-2.5 bg-app-surface-elevated/30 rounded-xl px-3.5 py-2.5 border border-app-border/20">
                            {resource.linkPreview?.favicon ? (
                                <img
                                    src={resource.linkPreview.favicon}
                                    alt=""
                                    className="w-4 h-4 rounded-sm shrink-0"
                                    onError={(e) => {
                                        (
                                            e.target as HTMLImageElement
                                        ).style.display = "none";
                                    }}
                                />
                            ) : (
                                <Link2
                                    size={13}
                                    className="text-app-text-muted/40 shrink-0"
                                />
                            )}
                            <span className="text-[11px] text-blue-400/80 truncate flex-1 select-all">
                                {resource.url}
                            </span>
                            <button
                                onClick={handleOpenLink}
                                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                            >
                                <ExternalLink size={10} />
                                Open
                            </button>
                        </div>
                    )}

                    {/* Link preview description (separate from user content) */}
                    {resource.type === "link" &&
                        resource.linkPreview?.description && (
                            <div className="bg-app-surface-elevated/20 rounded-xl px-3.5 py-3 border border-app-border/15">
                                <span className="text-[9px] font-bold uppercase tracking-wider text-app-text-muted/40 block mb-1">
                                    Site Description
                                </span>
                                <p className="text-[12px] text-app-text-muted/80 leading-relaxed">
                                    {resource.linkPreview.description}
                                </p>
                            </div>
                        )}

                    {/* Content / Notes */}
                    {isEditing ? (
                        <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            rows={6}
                            className="w-full bg-app-surface-elevated/50 border border-app-border rounded-xl px-4 py-3 text-[13px] text-app-text-main placeholder:text-app-text-muted/50 outline-none focus:border-app-accent/50 resize-none leading-relaxed"
                            placeholder="Notes or content..."
                        />
                    ) : resource.content ? (
                        <div>
                            {resource.type === "link" && (
                                <span className="text-[9px] font-bold uppercase tracking-wider text-app-text-muted/40 block mb-1">
                                    Notes
                                </span>
                            )}
                            <p className="text-[13px] text-app-text-muted leading-relaxed whitespace-pre-wrap">
                                {resource.content}
                            </p>
                        </div>
                    ) : null}

                    {/* Metadata */}
                    <div className="flex items-center gap-4 pt-2">
                        <span className="inline-flex items-center gap-1.5 text-[10px] text-app-text-muted/50">
                            <Calendar size={10} />
                            {createdDate}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-[10px] text-app-text-muted/50">
                            <Clock size={10} />
                            {createdTime}
                        </span>
                        <span className="text-[10px] text-app-text-muted/40">
                            {timeAgo(resource.createdAt)}
                        </span>
                    </div>
                </div>

                {/* ── Action bar ── */}
                <div className="shrink-0 flex items-center justify-between px-5 py-3 border-t border-app-border/20 bg-app-surface/30">
                    {isEditing ? (
                        <>
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-4 py-2 text-[12px] text-app-text-muted hover:text-app-text-main rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                className="px-5 py-2 text-[12px] font-semibold bg-app-accent/20 text-app-accent border border-app-accent/30 rounded-xl hover:bg-app-accent/30 transition-colors"
                            >
                                Save Changes
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => {
                                    onDelete(resource.id);
                                    onClose();
                                }}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[11px] font-medium text-red-400/80 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                            >
                                <Trash2 size={13} />
                                Delete
                            </button>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => onTogglePin(resource.id)}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[11px] font-medium text-app-text-muted hover:text-app-text-main hover:bg-app-hover rounded-xl transition-colors"
                                >
                                    {resource.isPinned ? (
                                        <>
                                            <PinOff size={13} />
                                            Unpin
                                        </>
                                    ) : (
                                        <>
                                            <Pin size={13} />
                                            Pin
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={() => {
                                        setEditTitle(resource.title);
                                        setEditContent(resource.content);
                                        setEditType(resource.type);
                                        setIsEditing(true);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[11px] font-medium bg-app-accent/15 text-app-accent border border-app-accent/25 rounded-xl hover:bg-app-accent/25 transition-colors"
                                >
                                    <Pencil size={13} />
                                    Edit
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
