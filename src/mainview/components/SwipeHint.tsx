/**
 * SwipeHint — live swipe progress indicator.
 *
 * Driven entirely by `swipeProgress` (-1 to 1):
 *   > 0  → user is swiping right  → show LEFT hint  ("back")
 *   < 0  → user is swiping left   → show RIGHT hint ("forward")
 *   = 0  → hidden
 *
 * Clicking a hint triggers the navigation action directly.
 * The hints have no permanent visibility — they only appear during
 * an active gesture, so they never clutter the UI at rest.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";

interface SwipeHintProps {
    /** Live swipe progress from useSwipeGesture (-1 to 1, 0 = idle) */
    swipeProgress?: number;
    leftLabel?: string;
    rightLabel?: string;
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    /** Which sides are actually navigable (prevents hint showing when there's nowhere to go) */
    canGoLeft?: boolean;
    canGoRight?: boolean;
}

const SHOW_THRESHOLD = 0.08; // minimum |progress| before hint appears

export default function SwipeHint({
    swipeProgress = 0,
    leftLabel = "Go back",
    rightLabel = "Go forward",
    onSwipeLeft,
    onSwipeRight,
    canGoLeft = true,
    canGoRight = true,
}: SwipeHintProps) {
    const showLeft = swipeProgress > SHOW_THRESHOLD && canGoLeft;
    const showRight = swipeProgress < -SHOW_THRESHOLD && canGoRight;

    if (!showLeft && !showRight) return null;

    // Opacity scales 0→1 over the first 30% of threshold→1
    const rawAbs = Math.abs(swipeProgress);
    const opacity = Math.min((rawAbs - SHOW_THRESHOLD) / 0.3, 1);
    // Translate slides in from the edge as progress grows
    const translatePct = Math.max(0, (1 - rawAbs) * 60);

    const sharedInnerClass =
        "flex items-center gap-1.5 py-2 rounded-full " +
        "bg-mac-surface/80 backdrop-blur-xl " +
        "border border-mac-border/40 shadow-mac-md " +
        "transition-shadow duration-150";

    return (
        <>
            {/* ── Left hint (swiping right → go back) ───────────────────── */}
            {showLeft && (
                <button
                    onClick={onSwipeRight}
                    title={leftLabel}
                    aria-label={leftLabel}
                    style={{
                        position: "absolute",
                        left: 0,
                        top: "50%",
                        transform: `translateY(-50%) translateX(-${translatePct}%)`,
                        opacity,
                        zIndex: 50,
                        transition:
                            "opacity 80ms linear, transform 80ms linear",
                    }}
                    className="group flex items-center cursor-pointer focus:outline-none"
                >
                    <div className={`${sharedInnerClass} ml-2 pl-1.5 pr-3`}>
                        <ChevronLeft className="w-3.5 h-3.5 text-mac-accent" />
                        <span className="text-[11px] font-medium leading-none text-mac-secondary select-none">
                            {leftLabel}
                        </span>
                    </div>
                </button>
            )}

            {/* ── Right hint (swiping left → go forward) ────────────────── */}
            {showRight && (
                <button
                    onClick={onSwipeLeft}
                    title={rightLabel}
                    aria-label={rightLabel}
                    style={{
                        position: "absolute",
                        right: 0,
                        top: "50%",
                        transform: `translateY(-50%) translateX(${translatePct}%)`,
                        opacity,
                        zIndex: 50,
                        transition:
                            "opacity 80ms linear, transform 80ms linear",
                    }}
                    className="group flex items-center cursor-pointer focus:outline-none"
                >
                    <div className={`${sharedInnerClass} mr-2 pr-1.5 pl-3`}>
                        <span className="text-[11px] font-medium leading-none text-mac-secondary select-none">
                            {rightLabel}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-mac-accent" />
                    </div>
                </button>
            )}
        </>
    );
}
