/**
 * AddResourceForm — Simplified "Mind Dump" input bar for the Resource Vault
 * Auto-detects URLs, supports image paste/drop/upload, and uses AI for text categorization.
 */
import { ArrowUp, ImageIcon, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { VaultResourceType } from "../../../shared/types.ts";
import { readClipboardImage } from "../../rpc.ts";

const URL_REGEX = /^https?:\/\//i;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

interface AddResourceFormProps {
    onAdd: (params: {
        type: VaultResourceType;
        title: string;
        content: string;
        url?: string;
    }) => Promise<void>;
    onAiEnhance: (rawInput: string) => Promise<{
        type: VaultResourceType;
        title: string;
        content: string;
    } | null>;
}

export default function AddResourceForm({
    onAdd,
    onAiEnhance,
}: AddResourceFormProps) {
    const [inputValue, setInputValue] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [stagedImage, setStagedImage] = useState<{
        dataUrl: string;
        name: string;
    } | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-expand textarea height
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.style.height = "auto";
        const newHeight = Math.max(46, textarea.scrollHeight);
        textarea.style.height = `${newHeight}px`;
    }, [inputValue]);

    const processImageFile = useCallback(async (file: File) => {
        if (!file.type.startsWith("image/")) return;
        if (file.size > MAX_IMAGE_SIZE_BYTES) {
            alert("Image too large (max 5MB)");
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setStagedImage({
                dataUrl: reader.result as string,
                name: file.name,
            });
        };
        reader.readAsDataURL(file);
    }, []);

    const handlePaste = useCallback(
        async (e: React.ClipboardEvent) => {
            const clipboardData = e.clipboardData;
            if (!clipboardData) return;

            // Extract items and files
            const items = Array.from(clipboardData.items);
            const files = Array.from(clipboardData.files);

            let imageFound = false;

            // Priority 1: Standard Image Items
            if (items.length > 0) {
                for (const item of items) {
                    if (item.type.startsWith("image/")) {
                        const file = item.getAsFile();
                        if (file) {
                            void processImageFile(file);
                            imageFound = true;
                        }
                    }
                }
            }

            // Priority 2: Standard Image Files
            if (!imageFound && files.length > 0) {
                for (const file of files) {
                    if (file.type.startsWith("image/")) {
                        void processImageFile(file);
                        imageFound = true;
                    }
                }
            }

            // If we found an image via standard APIs, prevent default to avoid
            // also pasting the text metadata or causing double-triggers.
            if (imageFound) {
                e.preventDefault();
                return;
            }

            // Priority 3: Native RPC fallback (for OS-specific gaps)
            // Guard: If there is clear plain text, skip the expensive native fallback
            // unless we specifically want to prioritize image extraction.
            const hasText = clipboardData.types.includes("text/plain");
            if (!hasText) {
                try {
                    const result = await readClipboardImage();
                    if (result.dataUrl) {
                        setStagedImage({
                            dataUrl: result.dataUrl,
                            name: `pasted-image-${Date.now()}.png`,
                        });
                        imageFound = true;
                        // Since this is async, preventDefault was already decided
                        // by the browser, but we've staged our image.
                    }
                } catch (err) {
                    console.error("[Vault] Native RPC fallback failed:", err);
                }
            }
        },
        [processImageFile],
    );

    const handleSubmit = useCallback(async () => {
        const trimmed = inputValue.trim();
        if (!trimmed && !stagedImage) return;

        setIsSubmitting(true);
        try {
            // Case 1: Staged Image
            if (stagedImage) {
                await onAdd({
                    type: "image",
                    title: trimmed || stagedImage.name.replace(/\.\w+$/, ""),
                    content: trimmed || "",
                    url: stagedImage.dataUrl,
                });
            }
            // Case 2: URL Detection
            else if (URL_REGEX.test(trimmed)) {
                await onAdd({
                    type: "link",
                    title: trimmed,
                    content: "",
                    url: trimmed,
                });
            }
            // Case 3: General Text (AI Categorization)
            else {
                const enhanced = await onAiEnhance(trimmed);
                if (enhanced) {
                    await onAdd({
                        type: enhanced.type,
                        title: enhanced.title,
                        content: enhanced.content,
                    });
                } else {
                    await onAdd({
                        type: "note",
                        title: trimmed.split("\n")[0].slice(0, 60),
                        content: trimmed,
                    });
                }
            }

            setInputValue("");
            setStagedImage(null);
        } catch (err) {
            console.error("[Vault] Failed to process input:", err);
        } finally {
            setIsSubmitting(false);
        }
    }, [inputValue, stagedImage, onAiEnhance, onAdd]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit();
            }
        },
        [handleSubmit],
    );

    return (
        <div className="flex flex-col bg-app-surface-elevated/40 border border-app-border/50 rounded-2xl transition-all focus-within:border-app-accent/30 overflow-hidden">
            {/* ── Staged Image Attachment ── */}
            {stagedImage && (
                <div className="p-3 pb-0 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="relative inline-block group/img">
                        <div className="w-24 h-24 rounded-xl overflow-hidden border border-app-border/50 shadow-sm bg-black/20">
                            <img
                                src={stagedImage.dataUrl}
                                alt="Attachment"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <button
                            onClick={() => setStagedImage(null)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-app-text-main text-app-bg flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                        >
                            <X size={12} strokeWidth={3} />
                        </button>
                    </div>
                </div>
            )}

            <div className="relative flex items-end">
                {/* ── Main Textarea ── */}
                <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder={
                        stagedImage
                            ? "Add a caption..."
                            : "Paste a link, attach an image, or jot a note..."
                    }
                    rows={1}
                    className="flex-1 bg-transparent border-none px-4 py-3 text-[14px] text-app-text-main placeholder:text-app-text-muted/40 outline-none transition-all resize-none overflow-hidden min-h-[46px] max-h-[300px]"
                />

                {/* ── Buttons Container ── */}
                <div className="flex items-center gap-1 pr-2 pb-2.5">
                    {/* Upload Button */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-app-text-muted/90 hover:text-app-text-main hover:bg-app-surface-elevated transition-all"
                        title="Upload image"
                    >
                        <ImageIcon size={16} />
                    </button>

                    {/* Send Button */}
                    <button
                        onClick={() => void handleSubmit()}
                        disabled={
                            isSubmitting || (!inputValue.trim() && !stagedImage)
                        }
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 text-app-text-muted/90 hover:text-app-text-main hover:bg-app-surface-elevated disabled:opacity-30"
                        title="Process (Enter)"
                    >
                        {isSubmitting ? (
                            <div className="w-3.5 h-3.5 border-2 border-app-text-muted/20 border-t-app-text-muted/60 rounded-full animate-spin" />
                        ) : (
                            <ArrowUp size={16} strokeWidth={2.5} />
                        )}
                    </button>
                </div>
            </div>

            {/* Hidden File Input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void processImageFile(file);
                    e.target.value = "";
                }}
            />
        </div>
    );
}
