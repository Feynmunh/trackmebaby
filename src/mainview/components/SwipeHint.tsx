/**
 * SwipeHint — Chrome-style drag-to-navigate indicator.
 *
 * The circle grows and slides in from the edge as the user drags,
 * exactly like Chrome's back/forward swipe gesture.
 *
 * swipeProgress (-1 to 1):
 *   > 0  → dragging right → left arrow appears on the left edge
 *   < 0  → dragging left  → right arrow appears on the right edge
 *   = 0  → hidden
 */

import { ChevronLeft, ChevronRight } from "lucide-react";

interface SwipeHintProps {
    swipeProgress?: number;
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    canGoLeft?: boolean;
    canGoRight?: boolean;
}

const SHOW_THRESHOLD = 0.04;

export default function SwipeHint({
    swipeProgress = 0,
    onSwipeLeft,
    onSwipeRight,
    canGoLeft = true,
    canGoRight = true,
}: SwipeHintProps) {
    // Dragging right (positive progress) → show left arrow (go back)
    const showLeft = swipeProgress > SHOW_THRESHOLD && canGoLeft;
    // Dragging left (negative progress) → show right arrow (go forward)
    const showRight = swipeProgress < -SHOW_THRESHOLD && canGoRight;

    if (!showLeft && !showRight) return null;

    const raw = Math.abs(swipeProgress);

    // Circle grows from 24px to 56px as drag increases
    const size = 24 + Math.min(raw, 1) * 32;
    // Slides in from edge: starts off-screen, fully visible at progress=1
    const inset = Math.max(0, (1 - raw) * 40);
    // Opacity fades in quickly
    const opacity = Math.min((raw - SHOW_THRESHOLD) / 0.2, 1);
    // Icon scales with the circle
    const iconSize = Math.round(10 + Math.min(raw, 1) * 10);

    const circleStyle: React.CSSProperties = {
        position: "absolute",
        top: "50%",
        transform: "translateY(-50%)",
        width: size,
        height: size,
        borderRadius: "50%",
        background: "rgba(30,30,30,0.85)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        zIndex: 100,
        transition: "opacity 60ms linear",
        pointerEvents: "auto",
        cursor: "pointer",
    };

    return (
        <>
            {showLeft && (
                <button
                    onClick={onSwipeRight}
                    aria-label="Go back"
                    style={{
                        ...circleStyle,
                        left: inset,
                    }}
                >
                    <ChevronLeft
                        style={{
                            width: iconSize,
                            height: iconSize,
                            color: "#ff6b35",
                            strokeWidth: 3,
                        }}
                    />
                </button>
            )}

            {showRight && (
                <button
                    onClick={onSwipeLeft}
                    aria-label="Go forward"
                    style={{
                        ...circleStyle,
                        right: inset,
                    }}
                >
                    <ChevronRight
                        style={{
                            width: iconSize,
                            height: iconSize,
                            color: "#ff6b35",
                            strokeWidth: 3,
                        }}
                    />
                </button>
            )}
        </>
    );
}
