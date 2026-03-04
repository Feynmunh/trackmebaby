import {
    motion,
    type PanInfo,
    useMotionValue,
    useTransform,
} from "motion/react";
import { useState } from "react";
import type { WardenInsight } from "../../../shared/types.ts";
import InsightCard from "./InsightCard.tsx";

interface SwipeableCardProps {
    insight: WardenInsight;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
    onSwipeLeft: (id: string) => void; // Dismiss
    onSwipeRight: (id: string) => void; // Approve
    onSwipeUp?: (id: string) => void; // Like/Vault
    onLike?: (id: string) => void; // Click like
    isTop: boolean;
    index: number;
}

export default function SwipeableCard({
    insight,
    isExpanded,
    onToggleExpand,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onLike,
    isTop,
    index,
}: SwipeableCardProps) {
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    // Visual Feedback Transforms
    const rotate = useTransform(x, [-200, 200], [-10, 10]);

    // Stamp Opacities
    const ignoreOpacity = useTransform(x, [-40, -120], [0, 1]);
    const approveOpacity = useTransform(x, [40, 120], [0, 1]);
    const likeOpacity = useTransform(y, [-40, -120], [0, 1]);

    // Stamp Scales
    const ignoreScale = useTransform(x, [-40, -120], [0.9, 1.1]);
    const approveScale = useTransform(x, [40, 120], [0.9, 1.1]);
    const likeScale = useTransform(y, [-40, -120], [0.9, 1.1]);

    const [exitX, setExitX] = useState<number | string>(0);
    const [exitY, setExitY] = useState<number | string>(0);

    const handleDragEnd = (_: unknown, info: PanInfo) => {
        const threshold = 120;
        const velocityThreshold = 500;

        if (
            info.offset.x > threshold ||
            (info.velocity.x > velocityThreshold && info.offset.x > 20)
        ) {
            setExitX(1000);
            onSwipeRight(insight.id);
        } else if (
            info.offset.x < -threshold ||
            (info.velocity.x < -velocityThreshold && info.offset.x < -20)
        ) {
            setExitX(-1000);
            onSwipeLeft(insight.id);
        } else if (
            (info.offset.y < -threshold ||
                (info.velocity.y < -velocityThreshold &&
                    info.offset.y < -20)) &&
            onSwipeUp
        ) {
            setExitY(-1000);
            onSwipeUp(insight.id);
        }
    };

    // Mechanical stack properties
    const depthY = index * 8;
    const depthScale = 1 - index * 0.02;
    const depthOpacity = isTop ? 1 : Math.max(0.1, 0.4 - index * 0.1);

    return (
        <motion.div
            style={{
                x,
                y,
                rotate,
                zIndex: 100 - index,
                position: "absolute",
                width: "100%",
                cursor: isTop ? "grab" : "default",
            }}
            drag={isTop}
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            onDragEnd={handleDragEnd}
            initial={{ opacity: 0, y: 10 }}
            animate={{
                y: depthY,
                scale: depthScale,
                opacity: depthOpacity,
                transition: {
                    type: "spring",
                    stiffness: 400,
                    damping: 30,
                },
            }}
            exit={{
                x: exitX,
                y: exitY,
                opacity: 0,
                transition: { duration: 0.2, ease: "easeOut" },
            }}
            whileDrag={{ cursor: "grabbing" }}
            className="touch-none"
        >
            {/* Action Feedback Stamps */}
            {isTop && (
                <>
                    {/* APPROVE STAMP */}
                    <motion.div
                        style={{ opacity: approveOpacity, scale: approveScale }}
                        className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
                    >
                        <div className="border-4 border-app-accent/40 bg-app-accent/5 px-8 py-3 rounded-xl rotate-[-12deg] shadow-[0_0_40px_rgba(var(--app-accent),0.1)]">
                            <span className="font-mono text-4xl font-black tracking-[0.3em] text-app-accent uppercase">
                                Approve
                            </span>
                        </div>
                    </motion.div>

                    {/* IGNORE STAMP */}
                    <motion.div
                        style={{ opacity: ignoreOpacity, scale: ignoreScale }}
                        className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
                    >
                        <div className="border-4 border-zinc-500/40 bg-zinc-500/5 px-8 py-3 rounded-xl rotate-[12deg]">
                            <span className="font-mono text-4xl font-black tracking-[0.3em] text-zinc-500 uppercase">
                                Ignore
                            </span>
                        </div>
                    </motion.div>

                    {/* LIKE STAMP */}
                    <motion.div
                        style={{ opacity: likeOpacity, scale: likeScale }}
                        className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
                    >
                        <div className="border-4 border-pink-500/40 bg-pink-500/5 px-8 py-3 rounded-xl shadow-[0_0_40px_rgba(236,72,153,0.1)]">
                            <span className="font-mono text-4xl font-black tracking-[0.3em] text-pink-500 uppercase">
                                Love It
                            </span>
                        </div>
                    </motion.div>
                </>
            )}

            <div className="w-full shadow-2xl overflow-hidden rounded-app-lg bg-app-surface">
                <InsightCard
                    insight={insight}
                    isExpanded={isExpanded}
                    onToggleExpand={onToggleExpand}
                    onApprove={undefined}
                    onDismiss={undefined}
                    onLike={isTop ? onLike : undefined}
                />
            </div>
        </motion.div>
    );
}
