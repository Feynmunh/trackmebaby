import { Check, Copy, Github } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { openExternalUrl } from "../../rpc";

interface GitHubDeviceFlowModalProps {
    isOpen: boolean;
    userCode: string;
    verificationUri: string;
    onCancel: () => void;
}

export default function GitHubDeviceFlowModal({
    isOpen,
    userCode,
    verificationUri,
    onCancel,
}: GitHubDeviceFlowModalProps) {
    const [copied, setCopied] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(userCode);
            setCopied(true);
            setTimeout(() => {
                openExternalUrl(verificationUri);
                setCopied(false);
            }, 600);
        } catch (err) {
            console.error("Failed to copy code", err);
        }
    }, [userCode, verificationUri]);

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

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [isOpen, onCancel]);

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
                className="relative w-full max-w-sm bg-app-surface border border-app-border rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
                style={{
                    backgroundColor: "hsl(var(--app-surface-elevated))",
                }}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-app-border/20 bg-app-surface/50">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-app-accent/10 text-app-accent">
                            <Github size={20} />
                        </div>
                        <h3 className="text-[16px] font-bold text-app-text-main">
                            GitHub Authorization
                        </h3>
                    </div>
                </div>

                <div className="px-6 py-10 flex flex-col gap-8 text-center bg-app-bg/20">
                    <p className="text-[14px] text-app-text-main font-medium leading-relaxed">
                        Enter this code on GitHub to authorize:
                    </p>

                    <div className="py-5 bg-app-bg border border-app-border/50 rounded-2xl font-mono text-[32px] font-black tracking-[0.25em] text-app-accent shadow-inner selection:bg-app-accent/20">
                        {userCode}
                    </div>
                </div>

                <div className="px-5 py-4 border-t border-app-border/20 bg-app-surface/50 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="w-full sm:w-auto px-5 py-2 text-[13px] font-bold text-app-text-main bg-app-bg hover:bg-app-hover rounded-xl transition-all border border-app-border/40"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCopy}
                        className="w-full sm:w-auto px-6 py-2 text-[13px] font-bold rounded-xl transition-all active:scale-95 bg-app-accent hover:bg-app-accent/90 text-white shadow-lg shadow-app-accent/40 flex items-center justify-center gap-2"
                    >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                        {copied ? "Copied" : "Copy & Open"}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
