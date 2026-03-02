/**
 * SwipeIndicator — visual feedback for trackpad swipe navigation.
 *
 * Shows on the left or right edge while the user is dragging.
 * Grows and brightens with drag progress.
 * Pops (scale burst) when a swipe commits.
 * Fades out on snap-back.
 *
 * Props:
 *   progress  — live drag value, -1..1  (negative = swiping left, positive = swiping right)
 *   committed — true for one frame after a swipe commits, triggers the pop
 *   canGoLeft / canGoRight — whether there's a tab in that direction; dims arrow if not
 */

import { useEffect, useRef, useState } from "react";

interface SwipeIndicatorProps {
    progress: number;
    committed: boolean;
    canGoLeft: boolean;
    canGoRight: boolean;
}

export function SwipeIndicator({
    progress,
    committed,
    canGoLeft,
    canGoRight,
}: SwipeIndicatorProps) {
    // Which side is active
    const side: "left" | "right" | null =
        progress > 0.05 ? "right" : progress < -0.05 ? "left" : null;

    const abs = Math.abs(progress);

    // "popping" state — play burst animation for 400ms after commit
    const [popping, setPopping] = useState(false);
    const [poppingSide, setPoppingSide] = useState<"left" | "right">("right");
    const popTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (committed && side !== null) {
            setPoppingSide(side);
            setPopping(true);
            if (popTimer.current) clearTimeout(popTimer.current);
            popTimer.current = setTimeout(() => setPopping(false), 400);
        }
    }, [committed, side]);

    useEffect(
        () => () => {
            if (popTimer.current) clearTimeout(popTimer.current);
        },
        [],
    );

    const canGo =
        side === "left" ? canGoLeft : side === "right" ? canGoRight : false;

    // Nothing to show
    if (side === null && !popping) return null;

    const activeSide = popping ? poppingSide : side!;

    // Opacity and size scale with drag progress
    const opacity = Math.min(abs * 2.2, 1);
    // Arrow travels inward as progress grows (max 28px inset)
    const arrowInset = 12 + abs * 28;
    // Glow height grows from 60px to 180px
    const glowHeight = 60 + abs * 120;
    // Glow width grows
    const glowWidth = 20 + abs * 36;

    const isLeft = activeSide === "left";

    return (
        <>
            {/* Edge glow strip */}
            <div
                className="pointer-events-none absolute top-1/2 z-50"
                style={{
                    [isLeft ? "left" : "right"]: 0,
                    transform: "translateY(-50%)",
                    width: `${glowWidth}px`,
                    height: `${glowHeight}px`,
                    borderRadius: isLeft
                        ? "0 999px 999px 0"
                        : "999px 0 0 999px",
                    background: canGo
                        ? `radial-gradient(ellipse at ${isLeft ? "0%" : "100%"} 50%, rgba(225,81,14,${0.55 * opacity}) 0%, transparent 100%)`
                        : `radial-gradient(ellipse at ${isLeft ? "0%" : "100%"} 50%, rgba(255,255,255,${0.18 * opacity}) 0%, transparent 100%)`,
                    opacity: popping ? 0 : 1,
                    transition: popping
                        ? "opacity 300ms ease-out"
                        : abs < 0.05
                          ? "opacity 200ms ease-out, width 80ms, height 80ms"
                          : "none",
                }}
            />

            {/* Arrow container */}
            <div
                className="pointer-events-none absolute top-1/2 z-50 flex items-center justify-center"
                style={{
                    [isLeft ? "left" : "right"]: `${arrowInset}px`,
                    transform: "translateY(-50%)",
                    width: 32,
                    height: 32,
                    opacity: popping ? 0 : opacity,
                    transition: popping
                        ? "opacity 200ms ease-out"
                        : abs < 0.05
                          ? "opacity 200ms ease-out"
                          : "none",
                    animation: popping ? undefined : undefined,
                }}
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={
                        canGo ? "rgba(225,81,14,1)" : "rgba(255,255,255,0.5)"
                    }
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                        width: `${14 + abs * 10}px`,
                        height: `${14 + abs * 10}px`,
                        filter: canGo
                            ? `drop-shadow(0 0 ${4 + abs * 8}px rgba(225,81,14,${0.7 * opacity}))`
                            : "none",
                        transition: abs < 0.05 ? "all 200ms ease-out" : "none",
                    }}
                >
                    {isLeft ? (
                        <polyline points="15 18 9 12 15 6" />
                    ) : (
                        <polyline points="9 18 15 12 9 6" />
                    )}
                </svg>
            </div>

            {/* Pop burst circle — plays once on commit */}
            {popping && (
                <div
                    className="pointer-events-none absolute top-1/2 z-50"
                    style={{
                        [isLeft ? "left" : "right"]: "8px",
                        transform: "translateY(-50%)",
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        background: "rgba(225,81,14,0.25)",
                        animation:
                            "swipe-pop-burst 400ms cubic-bezier(0.25,0.46,0.45,0.94) forwards",
                    }}
                />
            )}
        </>
    );
}
