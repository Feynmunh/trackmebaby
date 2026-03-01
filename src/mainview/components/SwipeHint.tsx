/**
 * SwipeHint — minimal animated edge indicators for swipe navigation.
 *
 * Design: a small frosted-glass capsule with a bouncing chevron sits
 * at mid-height on the left/right edge. It animates in on mount and
 * loops the chevron nudge to draw attention without being intrusive.
 * Clicking it triggers the navigation action directly.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";

interface SwipeHintProps {
    showLeft?: boolean;
    showRight?: boolean;
    leftLabel?: string;
    rightLabel?: string;
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
}

export default function SwipeHint({
    showLeft = false,
    showRight = false,
    leftLabel = "Go back",
    rightLabel = "Go forward",
    onSwipeLeft,
    onSwipeRight,
}: SwipeHintProps) {
    if (!showLeft && !showRight) return null;

    return (
        <>
            {/* ── Left hint ─────────────────────────────────────────────── */}
            {showLeft && (
                <button
                    onClick={onSwipeRight}
                    title={leftLabel}
                    aria-label={leftLabel}
                    style={{
                        position: "absolute",
                        left: 0,
                        top: "50%",
                        zIndex: 50,
                        animation:
                            "swipe-hint-enter-left 300ms cubic-bezier(0.34,1.56,0.64,1) both",
                    }}
                    className="group flex items-center cursor-pointer focus:outline-none"
                >
                    {/* Frosted glass track */}
                    <div
                        className="flex items-center gap-1.5 ml-2 pl-1.5 pr-3 py-2
                                   rounded-full
                                   bg-mac-surface/70 backdrop-blur-xl
                                   border border-mac-border/40
                                   shadow-mac-md
                                   transition-all duration-150
                                   group-hover:bg-mac-surface/90
                                   group-hover:shadow-mac-lg
                                   group-hover:scale-105
                                   group-active:scale-95"
                        style={{
                            animation: "swipe-glow 2.4s ease-in-out infinite",
                        }}
                    >
                        {/* Bouncing chevron */}
                        <span
                            style={{
                                animation:
                                    "swipe-nudge-left 1.6s ease-in-out infinite",
                                display: "flex",
                            }}
                        >
                            <ChevronLeft className="w-3.5 h-3.5 text-mac-accent" />
                        </span>

                        {/* Label */}
                        <span className="text-[11px] font-medium leading-none text-mac-secondary group-hover:text-mac-text transition-colors duration-150 select-none">
                            {leftLabel}
                        </span>
                    </div>
                </button>
            )}

            {/* ── Right hint ────────────────────────────────────────────── */}
            {showRight && (
                <button
                    onClick={onSwipeLeft}
                    title={rightLabel}
                    aria-label={rightLabel}
                    style={{
                        position: "absolute",
                        right: 0,
                        top: "50%",
                        zIndex: 50,
                        animation:
                            "swipe-hint-enter-right 300ms cubic-bezier(0.34,1.56,0.64,1) both",
                    }}
                    className="group flex items-center cursor-pointer focus:outline-none"
                >
                    <div
                        className="flex items-center gap-1.5 mr-2 pr-1.5 pl-3 py-2
                                   rounded-full
                                   bg-mac-surface/70 backdrop-blur-xl
                                   border border-mac-border/40
                                   shadow-mac-md
                                   transition-all duration-150
                                   group-hover:bg-mac-surface/90
                                   group-hover:shadow-mac-lg
                                   group-hover:scale-105
                                   group-active:scale-95"
                        style={{
                            animation: "swipe-glow 2.4s ease-in-out infinite",
                        }}
                    >
                        {/* Label */}
                        <span className="text-[11px] font-medium leading-none text-mac-secondary group-hover:text-mac-text transition-colors duration-150 select-none">
                            {rightLabel}
                        </span>

                        {/* Bouncing chevron */}
                        <span
                            style={{
                                animation:
                                    "swipe-nudge-right 1.6s ease-in-out infinite",
                                display: "flex",
                            }}
                        >
                            <ChevronRight className="w-3.5 h-3.5 text-mac-accent" />
                        </span>
                    </div>
                </button>
            )}
        </>
    );
}
