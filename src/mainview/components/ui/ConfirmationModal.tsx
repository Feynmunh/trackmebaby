import { AlertCircle, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    isDangerous?: boolean;
}

export default function ConfirmationModal({
    isOpen,
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    onConfirm,
    onCancel,
    isDangerous = false,
}: ConfirmationModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const confirmButtonRef = useRef<HTMLButtonElement>(null);
    const cancelButtonRef = useRef<HTMLButtonElement>(null);
    const titleId = useId();
    const messageId = useId();

    useEffect(() => {
        if (!isOpen) return;

        setTimeout(() => {
            if (isDangerous) {
                cancelButtonRef.current?.focus();
            } else {
                confirmButtonRef.current?.focus();
            }
        }, 10);

        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onCancel();
            } else if (e.key === "Tab" && modalRef.current) {
                const focusableElements = modalRef.current.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
                );
                const firstElement = focusableElements[0] as HTMLElement;
                const lastElement = focusableElements[
                    focusableElements.length - 1
                ] as HTMLElement;

                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        };

        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [isOpen, onCancel, isDangerous]);

    const handleBackdropClick = useCallback(
        (e: React.MouseEvent) => {
            if (
                modalRef.current &&
                !modalRef.current.contains(e.target as Node)
            ) {
                onCancel();
            }
        },
        [onCancel],
    );

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-200"
            onClick={handleBackdropClick}
        >
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={messageId}
                className="relative w-full max-w-sm bg-app-surface border border-app-border rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
                style={{
                    backgroundColor: "hsl(var(--app-surface-elevated))",
                    backdropFilter: "none",
                    WebkitBackdropFilter: "none",
                }}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-app-border/20 bg-app-surface/50">
                    <div className="flex items-center gap-2.5">
                        <div
                            className={`p-2 rounded-lg ${isDangerous ? "bg-red-500/10 text-red-500" : "bg-app-accent/10 text-app-accent"}`}
                        >
                            <AlertCircle size={20} />
                        </div>
                        <h3
                            id={titleId}
                            className="text-[16px] font-bold text-app-text-main"
                        >
                            {title}
                        </h3>
                    </div>
                    <button
                        onClick={onCancel}
                        className="w-8 h-8 rounded-full bg-app-bg hover:bg-app-hover border border-app-border/30 flex items-center justify-center transition-colors"
                        aria-label="Close"
                    >
                        <X size={16} className="text-app-text-muted" />
                    </button>
                </div>

                <div className="px-6 py-8 text-center sm:text-left bg-app-bg/20">
                    <p
                        id={messageId}
                        className="text-[14px] text-app-text-main font-medium leading-relaxed"
                    >
                        {message}
                    </p>
                </div>

                <div className="px-5 py-4 border-t border-app-border/20 bg-app-surface/50 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
                    <button
                        ref={cancelButtonRef}
                        onClick={onCancel}
                        className="w-full sm:w-auto px-5 py-2 text-[13px] font-bold text-app-text-main bg-app-bg hover:bg-app-hover rounded-xl transition-all border border-app-border/40"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        ref={confirmButtonRef}
                        onClick={() => {
                            onConfirm();
                        }}
                        className={`w-full sm:w-auto px-6 py-2 text-[13px] font-bold rounded-xl transition-all active:scale-95 ${
                            isDangerous
                                ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/40"
                                : "bg-app-accent hover:bg-app-accent/90 text-white shadow-lg shadow-app-accent/40"
                        }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
