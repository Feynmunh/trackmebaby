import {
    AnimatePresence,
    type MotionValue,
    motion,
    type SpringOptions,
    useMotionValue,
    useSpring,
    useTransform,
} from "motion/react";
import {
    Children,
    cloneElement,
    isValidElement,
    type ReactNode,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

// ─── DockItem ───────────────────────────────────────────────────────────────

interface DockItemProps {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    mouseX: MotionValue<number>;
    spring: SpringOptions;
    distance: number;
    baseItemSize: number;
    magnification: number;
    isActive?: boolean;
}

function DockItem({
    children,
    onClick,
    disabled,
    mouseX,
    spring,
    distance,
    baseItemSize,
    magnification,
    isActive,
}: DockItemProps) {
    const ref = useRef<HTMLButtonElement>(null);
    const isHovered = useMotionValue(0);

    const mouseDistance = useTransform(mouseX, (val) => {
        const rect = ref.current?.getBoundingClientRect() ?? {
            x: 0,
            width: baseItemSize,
        };
        return val - rect.x - baseItemSize / 2;
    });

    const targetSize = useTransform(
        mouseDistance,
        [-distance, 0, distance],
        [baseItemSize, magnification, baseItemSize],
    );
    const size = useSpring(targetSize, spring);

    return (
        <motion.button
            ref={ref}
            type="button"
            disabled={disabled}
            style={{ width: size, height: size }}
            onHoverStart={() => isHovered.set(1)}
            onHoverEnd={() => isHovered.set(0)}
            onFocus={() => isHovered.set(1)}
            onBlur={() => isHovered.set(0)}
            onClick={disabled ? undefined : onClick}
            className={[
                "relative inline-flex shrink-0 items-center justify-center",
                "transition-colors duration-150 cursor-pointer select-none",
                isActive ? "text-app-accent" : "text-white",
                disabled ? "opacity-35 cursor-not-allowed" : "",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {Children.map(children, (child) =>
                isValidElement<{ isHovered?: MotionValue<number> }>(child)
                    ? cloneElement(child, { isHovered })
                    : child,
            )}
        </motion.button>
    );
}

// ─── DockLabel ───────────────────────────────────────────────────────────────

interface DockLabelProps {
    children: ReactNode;
    isHovered?: MotionValue<number>;
}

function DockLabel({ children, isHovered }: DockLabelProps) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!isHovered) return;
        const unsub = isHovered.on("change", (v) => setVisible(v === 1));
        return unsub;
    }, [isHovered]);

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: -2 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                    className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-app-surface border border-app-border px-2 py-0.5 text-[11px] text-app-text-main shadow-app-md"
                    role="tooltip"
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
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
            className="shrink-0 self-center"
            style={{
                width: 1,
                height: 20,
                margin: "0 4px",
                background: "rgba(255, 255, 255, 0.2)",
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
    magnification?: number;
    distance?: number;
    spring?: SpringOptions;
}

export default function PillDock({
    items,
    baseItemSize = 42,
    magnification = 58,
    distance = 120,
    spring = { mass: 0.1, stiffness: 180, damping: 14 },
}: PillDockProps) {
    const mouseX = useMotionValue(Infinity);
    const isHovered = useMotionValue(0);

    const maxHeight = useMemo(
        () => Math.max(magnification + 24, baseItemSize + 24),
        [magnification, baseItemSize],
    );
    const heightRow = useTransform(
        isHovered,
        [0, 1],
        [baseItemSize + 20, maxHeight],
    );
    const height = useSpring(heightRow, spring);

    return (
        <motion.div
            style={{ height }}
            className="flex items-center justify-center"
        >
            <motion.div
                onMouseMove={({ pageX }) => {
                    isHovered.set(1);
                    mouseX.set(pageX);
                }}
                onMouseLeave={() => {
                    isHovered.set(0);
                    mouseX.set(Infinity);
                }}
                className="dock-pill relative flex items-center gap-4 px-3 py-1.5"
                role="toolbar"
                aria-label="Navigation dock"
            >
                {items.map((item, i) => (
                    <div key={item.label} className="flex items-center">
                        {item.separator && i !== 0 && <DockSep />}
                        <DockItem
                            onClick={item.onClick}
                            disabled={item.disabled}
                            mouseX={mouseX}
                            spring={spring}
                            distance={distance}
                            baseItemSize={baseItemSize}
                            magnification={magnification}
                            isActive={item.isActive}
                        >
                            <DockIcon>{item.icon}</DockIcon>
                            <DockLabel>{item.label}</DockLabel>
                        </DockItem>
                    </div>
                ))}
            </motion.div>
        </motion.div>
    );
}
