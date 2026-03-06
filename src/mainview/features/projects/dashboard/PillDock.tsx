import { motion } from "motion/react";
import { type ReactNode } from "react";
import Tooltip from "../../../components/ui/Tooltip.tsx";

// ─── DockItem ───────────────────────────────────────────────────────────────

interface DockItemProps {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    baseItemSize: number;
    isActive?: boolean;
}

function DockItem({
    children,
    onClick,
    disabled,
    baseItemSize,
    isActive,
}: DockItemProps) {
    return (
        <motion.button
            type="button"
            disabled={disabled}
            style={{ width: baseItemSize, height: baseItemSize }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={disabled ? undefined : onClick}
            className={[
                "relative inline-flex shrink-0 items-center justify-center rounded-lg",
                "transition-colors duration-300 cursor-pointer select-none",
                isActive
                    ? "text-app-accent"
                    : "text-app-text-muted hover:text-app-text-main",
                disabled ? "opacity-35 cursor-not-allowed" : "",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {isActive && (
                <motion.div
                    layoutId="pill-dock-active"
                    className="absolute inset-0 bg-app-accent/10 rounded-lg shadow-[0_0_15px_rgba(var(--app-accent-rgb),0.08)] border border-app-accent/20"
                    transition={{
                        type: "spring",
                        bounce: 0.2,
                        duration: 0.5,
                    }}
                />
            )}
            <div className="relative z-10">{children}</div>
        </motion.button>
    );
}

// ─── DockIcon ────────────────────────────────────────────────────────────────

function DockIcon({ children }: { children: ReactNode }) {
    return (
        <div className="flex items-center justify-center w-full h-full">
            {children}
        </div>
    );
}

// ─── Divider ─────────────────────────────────────────────────────────────────

function DockSep() {
    return (
        <div
            className="shrink-0 self-center opacity-20"
            style={{
                width: 1,
                height: 14,
                margin: "0 2px",
                background: "currentColor",
            }}
        />
    );
}

// ─── Pill Dock ───────────────────────────────────────────────────────────────

interface PillDockItem {
    icon: ReactNode;
    label: string;
    onClick?: () => void;
    disabled?: boolean;
    isActive?: boolean;
    separator?: boolean; // separator BEFORE this item
}

interface PillDockProps {
    items: PillDockItem[];
    baseItemSize?: number;
}

export default function PillDock({ items, baseItemSize = 32 }: PillDockProps) {
    return (
        <div className="flex items-center justify-center">
            <div
                className="relative flex items-center gap-1.5 px-2 py-1.5 rounded-xl border border-app-border/40 bg-app-surface/40 backdrop-blur-sm"
                role="toolbar"
                aria-label="Navigation dock"
            >
                {items.map((item, i) => (
                    <div key={item.label} className="flex items-center gap-1.5">
                        {item.separator && i !== 0 && <DockSep />}
                        <Tooltip content={item.label} position="bottom">
                            <DockItem
                                onClick={item.onClick}
                                disabled={item.disabled}
                                baseItemSize={baseItemSize}
                                isActive={item.isActive}
                            >
                                <DockIcon>{item.icon}</DockIcon>
                            </DockItem>
                        </Tooltip>
                    </div>
                ))}
            </div>
        </div>
    );
}
