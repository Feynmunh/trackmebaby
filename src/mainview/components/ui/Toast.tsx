import { AnimatePresence, motion } from "motion/react";
import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useState,
} from "react";

type ToastType =
    | "info"
    | "success"
    | "error"
    | "warning"
    | "approve"
    | "dismiss"
    | "like";

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback(
        (message: string, type: ToastType = "info") => {
            const id = Math.random().toString(36).substring(2, 9);
            setToasts((prev) => [{ id, message, type }, ...prev]); // Add to top of stack
            setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
            }, 3000);
        },
        [],
    );

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {/* Global Stacking Toast Container */}
            <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none flex flex-col items-center">
                <AnimatePresence mode="popLayout">
                    {toasts.map((toast, index) => {
                        // Stacking effect calculations
                        const scale = 1 - index * 0.05;
                        const yOffset = index * 10;
                        const opacity = 1 - index * 0.3;
                        const blur = index * 1;

                        return (
                            <motion.div
                                key={toast.id}
                                layout
                                initial={{ opacity: 0, y: -40, scale: 0.9 }}
                                animate={{
                                    opacity: Math.max(0, opacity),
                                    y: yOffset,
                                    scale: Math.max(0.8, scale),
                                    filter: `blur(${blur}px)`,
                                    zIndex: 1000 - index,
                                }}
                                exit={{
                                    opacity: 0,
                                    scale: 0.8,
                                    y: -20,
                                    transition: { duration: 0.2 },
                                }}
                                transition={{
                                    type: "spring",
                                    stiffness: 400,
                                    damping: 30,
                                }}
                                style={{
                                    position:
                                        index === 0 ? "relative" : "absolute",
                                    top: 0,
                                }}
                                className="pointer-events-auto px-6 py-2.5 border border-app-border bg-app-surface-elevated shadow-app-lg backdrop-blur-xl rounded-full font-mono text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3 text-app-text-main min-w-[120px] justify-center"
                            >
                                <div className="w-1 h-1 rounded-full bg-app-text-main shadow-[0_0_8px_rgba(var(--app-text-main),0.4)]" />
                                {toast.message}
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}
