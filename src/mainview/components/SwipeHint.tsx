/**
 * SwipeHint — live swipe progress indicator.
 *
 * Driven entirely by `swipeProgress` (-1 to 1):
 *   > 0  → user is swiping right  → show LEFT hint  (go back)
 *   < 0  → user is swiping left   → show RIGHT hint (go forward)
 *   = 0  → hidden
 *
 * Only shows an icon — no text label.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";

interface SwipeHintProps {
    /** Live swipe progress from useSwipeGesture (-1 to 1, 0 = idle) */
    swipeProgress?: number;
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    /** Which sides are actually navigable */
    canGoLeft?: boolean;
    canGoRight?: boolean;
}

const SHOW_THRESHOLD = 0.08;

export default function SwipeHint({
    swipeProgress = 0,
    onSwipeLeft,
    onSwipeRight,
    canGoLeft = true,
    canGoRight = true,
}: SwipeHintProps) {
    const showLeft = swipeProgress > SHOW_THRESHOLD && canGoLeft;
    const showRight = swipeProgress < -SHOW_THRESHOLD && canGoRight;

    if (!showLeft && !showRight) return null;

    const rawAbs = Math.abs(swipeProgress);
    const opacity = Math.min((rawAbs - SHOW_THRESHOLD) / 0.3, 1);
    const translatePct = Math.max(0, (1 - rawAbs) * 60);

    const innerClass =
        "flex items-center justify-center p-2 rounded-full " +
        "bg-mac-surface/80 backdrop-blur-xl " +
        "border border-mac-border/40 shadow-mac-md";

    return (
        <>
            {/* ── Left hint ───────────────────────────────────────────────── */}
            {showLeft && (
                <button
                    onClick={onSwipeRight}
                    aria-label="Go back"
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
                    className="ml-2 cursor-pointer focus:outline-none"
                >
                    <div className={innerClass}>
                        <ChevronLeft className="w-4 h-4 text-mac-accent" />
                    </div>
                </button>
            )}

            {/* ── Right hint ──────────────────────────────────────────────── */}
            {showRight && (
                <button
                    onClick={onSwipeLeft}
                    aria-label="Go forward"
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
                    className="mr-2 cursor-pointer focus:outline-none"
                >
                    <div className={innerClass}>
                        <ChevronRight className="w-4 h-4 text-mac-accent" />
                    </div>
                </button>
            )}
        </>
    );
}
