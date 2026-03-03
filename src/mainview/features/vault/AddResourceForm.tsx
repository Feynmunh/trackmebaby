/**
 * AddResourceForm — Smart quick-add bar for the Resource Vault
 * Auto-detects URLs, supports AI-assisted categorization
 */
import {
    ChevronDown,
    ChevronUp,
    FileText,
    Lightbulb,
    Link2,
    Plus,
    Scale,
    Sparkles,
    Target,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import type { VaultResourceType } from "../../../shared/types.ts";

const TYPE_OPTIONS: {
    type: VaultResourceType;
    icon: typeof Link2;
    label: string;
    color: string;
}[] = [
    { type: "link", icon: Link2, label: "Link", color: "text-blue-400" },
    { type: "note", icon: FileText, label: "Note", color: "text-emerald-400" },
    {
        type: "milestone",
        icon: Target,
        label: "Milestone",
        color: "text-amber-400",
    },
    {
        type: "idea",
        icon: Lightbulb,
        label: "Idea",
        color: "text-purple-400",
    },
    {
        type: "decision",
        icon: Scale,
        label: "Decision",
        color: "text-rose-400",
    },
];

const URL_REGEX = /^https?:\/\//i;

interface AddResourceFormProps {
    onAdd: (params: {
        type: VaultResourceType;
        title: string;
        content: string;
        url?: string;
        tags?: string[];
    }) => Promise<void>;
    onAiEnhance: (rawInput: string) => Promise<{
        type: VaultResourceType;
        title: string;
        content: string;
        tags: string[];
    } | null>;
}

export default function AddResourceForm({
    onAdd,
    onAiEnhance,
}: AddResourceFormProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedType, setSelectedType] = useState<VaultResourceType>("note");
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [url, setUrl] = useState("");
    const [tagsInput, setTagsInput] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const titleRef = useRef<HTMLInputElement>(null);

    const resetForm = useCallback(() => {
        setTitle("");
        setContent("");
        setUrl("");
        setTagsInput("");
        setSelectedType("note");
        setIsExpanded(false);
    }, []);

    // Auto-detect URL when user types/pastes in the title field
    const handleTitleChange = useCallback(
        (value: string) => {
            setTitle(value);
            if (URL_REGEX.test(value.trim())) {
                setSelectedType("link");
                setUrl(value.trim());
                // Try to extract a readable title from the URL
                try {
                    const parsed = new URL(value.trim());
                    const pathTitle = parsed.pathname
                        .split("/")
                        .filter(Boolean)
                        .pop();
                    if (pathTitle && pathTitle.length > 2) {
                        setContent(
                            pathTitle
                                .replace(/[-_]/g, " ")
                                .replace(/\.\w+$/, ""),
                        );
                    }
                } catch {
                    // ignore
                }
                if (!isExpanded) setIsExpanded(true);
            }
        },
        [isExpanded],
    );

    const handleSubmit = useCallback(async () => {
        if (!title.trim()) return;

        setIsSubmitting(true);
        try {
            const tags = tagsInput
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean);

            const isLink = selectedType === "link";
            const resourceUrl = isLink ? url || title : undefined;
            const resourceTitle = isLink && !content ? title : title;

            await onAdd({
                type: selectedType,
                title: resourceTitle.trim(),
                content: content.trim(),
                url: resourceUrl,
                tags: tags.length > 0 ? tags : undefined,
            });

            resetForm();
        } finally {
            setIsSubmitting(false);
        }
    }, [title, content, url, tagsInput, selectedType, onAdd, resetForm]);

    const handleAiEnhance = useCallback(async () => {
        const rawInput = title || content;
        if (!rawInput.trim()) return;

        setIsAiLoading(true);
        try {
            const result = await onAiEnhance(rawInput);
            if (result) {
                setSelectedType(result.type);
                setTitle(result.title);
                setContent(result.content);
                setTagsInput(result.tags.join(", "));
                if (!isExpanded) setIsExpanded(true);
            }
        } finally {
            setIsAiLoading(false);
        }
    }, [title, content, onAiEnhance, isExpanded]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey && !isExpanded) {
                e.preventDefault();
                void handleSubmit();
            }
            if (e.key === "Enter" && e.metaKey) {
                e.preventDefault();
                void handleSubmit();
            }
            if (e.key === "Escape") {
                resetForm();
            }
        },
        [isExpanded, handleSubmit, resetForm],
    );

    return (
        <div className="rounded-2xl border border-app-border bg-app-surface/30 backdrop-blur-sm overflow-hidden transition-all duration-200">
            {/* ── Quick input bar ── */}
            <div className="flex items-center gap-2 p-3">
                <div className="flex-1 relative">
                    <input
                        ref={titleRef}
                        type="text"
                        value={title}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => !isExpanded && setIsExpanded(false)}
                        placeholder="Paste a link, jot a note, capture an idea..."
                        className="w-full bg-app-surface-elevated/40 border border-app-border/50 rounded-xl px-4 py-2.5 text-[13px] text-app-text-main placeholder:text-app-text-muted/40 outline-none focus:border-app-accent/40 transition-colors"
                    />
                </div>

                {/* AI enhance button */}
                <button
                    onClick={() => void handleAiEnhance()}
                    disabled={isAiLoading || (!title && !content)}
                    className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-app-surface-elevated/40 border border-app-border/50 hover:border-purple-500/30 hover:bg-purple-500/10 disabled:opacity-30 transition-all"
                    title="AI auto-categorize"
                >
                    {isAiLoading ? (
                        <div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                    ) : (
                        <Sparkles size={14} className="text-purple-400" />
                    )}
                </button>

                {/* Expand / Collapse */}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-app-surface-elevated/40 border border-app-border/50 hover:bg-app-hover transition-all"
                    title={isExpanded ? "Collapse" : "Expand"}
                >
                    {isExpanded ? (
                        <ChevronUp size={14} className="text-app-text-muted" />
                    ) : (
                        <ChevronDown
                            size={14}
                            className="text-app-text-muted"
                        />
                    )}
                </button>

                {/* Quick add button */}
                <button
                    onClick={() => void handleSubmit()}
                    disabled={isSubmitting || !title.trim()}
                    className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-app-accent/20 border border-app-accent/30 hover:bg-app-accent/30 disabled:opacity-30 transition-all"
                    title="Add resource (Enter)"
                >
                    {isSubmitting ? (
                        <div className="w-4 h-4 border-2 border-app-accent/30 border-t-app-accent rounded-full animate-spin" />
                    ) : (
                        <Plus size={14} className="text-app-accent" />
                    )}
                </button>
            </div>

            {/* ── Expanded form ── */}
            {isExpanded && (
                <div className="px-3 pb-3 space-y-3 border-t border-app-border/30 pt-3">
                    {/* Type selector pills */}
                    <div className="flex items-center gap-1.5">
                        {TYPE_OPTIONS.map((opt) => {
                            const Icon = opt.icon;
                            const isSelected = selectedType === opt.type;
                            return (
                                <button
                                    key={opt.type}
                                    onClick={() => setSelectedType(opt.type)}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                                        isSelected
                                            ? `${opt.color} bg-app-surface-elevated/60 border-current/20`
                                            : "text-app-text-muted/60 border-transparent hover:bg-app-surface-elevated/30"
                                    }`}
                                >
                                    <Icon size={12} />
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* URL field (shown for links) */}
                    {selectedType === "link" && (
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://..."
                            className="w-full bg-app-surface-elevated/40 border border-app-border/50 rounded-lg px-3 py-2 text-[12px] text-app-text-main placeholder:text-app-text-muted/40 outline-none focus:border-app-accent/40"
                        />
                    )}

                    {/* Content textarea */}
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={3}
                        placeholder={
                            selectedType === "note"
                                ? "Write your note..."
                                : selectedType === "milestone"
                                  ? "Describe the milestone..."
                                  : selectedType === "idea"
                                    ? "Describe your idea..."
                                    : selectedType === "decision"
                                      ? "What was decided and why..."
                                      : "Add a description..."
                        }
                        className="w-full bg-app-surface-elevated/40 border border-app-border/50 rounded-lg px-3 py-2 text-[12px] text-app-text-main placeholder:text-app-text-muted/40 outline-none focus:border-app-accent/40 resize-none"
                    />

                    {/* Tags */}
                    <input
                        type="text"
                        value={tagsInput}
                        onChange={(e) => setTagsInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Tags (comma separated)..."
                        className="w-full bg-app-surface-elevated/40 border border-app-border/50 rounded-lg px-3 py-2 text-[11px] text-app-text-main placeholder:text-app-text-muted/40 outline-none focus:border-app-accent/40"
                    />

                    {/* Submit row */}
                    <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-app-text-muted/50">
                            ⌘ Enter to save · Esc to cancel
                        </span>
                        <button
                            onClick={() => void handleSubmit()}
                            disabled={isSubmitting || !title.trim()}
                            className="px-4 py-1.5 text-[11px] font-semibold bg-app-accent/20 text-app-accent border border-app-accent/30 rounded-lg hover:bg-app-accent/30 disabled:opacity-40 transition-all"
                        >
                            {isSubmitting ? "Saving..." : "Add Resource"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
