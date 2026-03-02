/**
 * SwipeIndicator — visual feedback for trackpad swipe navigation.
 *
 * Shows on the left or right edge while the user is dragging:
 *   - Edge glow that grows with drag progress
 *   - 3-arrow trail that cascades (wave animation) while dragging
 *   - On commit: arrows shoot in the swipe direction + pop burst circle
 *   - On snap-back: everything fades out
 */

import { useEffect, useRef, useState } from "react";

interface SwipeIndicatorProps {
    progress: number;
    committed: boolean;
    canGoLeft: boolean;
    canGoRight: boolean;
}

/** A single arrow in the trail */
function TrailArrow({
    isLeft,
    canGo,
    opacity,
    abs,
    shooting,
    delayMs,
    waveDelayMs,
}: {
    isLeft: boolean;
    canGo: boolean;
    opacity: number;
    abs: number;
    shooting: boolean;
    delayMs: number;
    waveDelayMs: number;
}) {
    const color = canGo ? "rgba(225,81,14,1)" : "rgba(255,255,255,0.5)";
    const glowColor = canGo ? `rgba(225,81,14,${0.8 * opacity})` : "none";
    const size = 13 + abs * 8;

    // While shooting: play shoot keyframe once.
    // While dragging: play cascading wave loop.
    // While idle: no animation, opacity comes from parent fade.
    const animation = shooting
        ? `${isLeft ? "arrow-shoot-left" : "arrow-shoot-right"} 280ms cubic-bezier(0.25,0.46,0.45,0.94) ${delayMs}ms forwards`
        : abs > 0.05
          ? `${isLeft ? "arrow-wave-left" : "arrow-wave-right"} 600ms ease-in-out ${waveDelayMs}ms infinite`
          : "none";

    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
                width: `${size}px`,
                height: `${size}px`,
                flexShrink: 0,
                filter: canGo
                    ? `drop-shadow(0 0 ${3 + abs * 7}px ${glowColor})`
                    : "none",
                animation,
                opacity: shooting ? 1 : abs > 0.05 ? undefined : opacity,
                transition:
                    abs < 0.05 && !shooting ? "opacity 200ms ease-out" : "none",
            }}
        >
            {isLeft ? (
                <polyline points="15 18 9 12 15 6" />
            ) : (
                <polyline points="9 18 15 12 9 6" />
            )}
        </svg>
    );
}

export function SwipeIndicator({
    progress,
    committed,
    canGoLeft,
    canGoRight,
}: SwipeIndicatorProps) {
    const side: "left" | "right" | null =
        progress > 0.05 ? "right" : progress < -0.05 ? "left" : null;

    const abs = Math.abs(progress);

    // "popping" — burst circle after commit
    const [popping, setPopping] = useState(false);
    const [poppingSide, setPoppingSide] = useState<"left" | "right">("right");
    // "shooting" — arrows shoot away on commit
    const [shooting, setShooting] = useState(false);
    const popTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const shootTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (committed && side !== null) {
            setPoppingSide(side);
            setPopping(true);
            setShooting(true);
            if (popTimer.current) clearTimeout(popTimer.current);
            if (shootTimer.current) clearTimeout(shootTimer.current);
            popTimer.current = setTimeout(() => setPopping(false), 420);
            shootTimer.current = setTimeout(() => setShooting(false), 400);
        }
    }, [committed, side]);

    useEffect(
        () => () => {
            if (popTimer.current) clearTimeout(popTimer.current);
            if (shootTimer.current) clearTimeout(shootTimer.current);
        },
        [],
    );

    const canGo =
        side === "left" ? canGoLeft : side === "right" ? canGoRight : false;

    if (side === null && !popping && !shooting) return null;

    const activeSide = popping || shooting ? poppingSide : side!;
    const isLeft = activeSide === "left";

    // Glow dims/grows with progress
    const opacity = Math.min(abs * 2.2, 1);
    const glowHeight = 80 + abs * 140;
    const glowWidth = 24 + abs * 40;

    // Arrow cluster sits just inside the edge, moves inward as progress grows
    const clusterInset = 8 + abs * 20;

    return (
        <>
            {/* Edge glow */}
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
                        ? `radial-gradient(ellipse at ${isLeft ? "0%" : "100%"} 50%, rgba(225,81,14,${0.5 * opacity}) 0%, transparent 100%)`
                        : `radial-gradient(ellipse at ${isLeft ? "0%" : "100%"} 50%, rgba(255,255,255,${0.15 * opacity}) 0%, transparent 100%)`,
                    opacity: popping ? 0 : 1,
                    transition: popping
                        ? "opacity 300ms ease-out"
                        : abs < 0.05
                          ? "opacity 200ms ease-out"
                          : "none",
                }}
            />

            {/* 3-arrow trail cluster */}
            <div
                className="pointer-events-none absolute top-1/2 z-50 flex items-center"
                style={{
                    [isLeft ? "left" : "right"]: `${clusterInset}px`,
                    transform: "translateY(-50%)",
                    // arrows are side-by-side, pointing in swipe direction
                    flexDirection: isLeft ? "row-reverse" : "row",
                    gap: "2px",
                    opacity: shooting ? 1 : abs > 0.05 ? 1 : opacity,
                    transition:
                        abs < 0.05 && !shooting
                            ? "opacity 200ms ease-out"
                            : "none",
                }}
            >
                {/* Arrow 1 — leading (furthest in swipe direction) */}
                <TrailArrow
                    isLeft={isLeft}
                    canGo={canGo}
                    opacity={opacity}
                    abs={abs}
                    shooting={shooting}
                    delayMs={0}
                    waveDelayMs={0}
                />
                {/* Arrow 2 — middle */}
                <TrailArrow
                    isLeft={isLeft}
                    canGo={canGo}
                    opacity={opacity}
                    abs={abs}
                    shooting={shooting}
                    delayMs={40}
                    waveDelayMs={200}
                />
                {/* Arrow 3 — trailing */}
                <TrailArrow
                    isLeft={isLeft}
                    canGo={canGo}
                    opacity={opacity}
                    abs={abs}
                    shooting={shooting}
                    delayMs={80}
                    waveDelayMs={400}
                />
            </div>

            {/* Pop burst circle — plays once on commit */}
            {popping && (
                <div
                    className="pointer-events-none absolute top-1/2 z-50"
                    style={{
                        [isLeft ? "left" : "right"]: "8px",
                        transform: "translateY(-50%)",
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        background: "rgba(225,81,14,0.3)",
                        animation:
                            "swipe-pop-burst 420ms cubic-bezier(0.25,0.46,0.45,0.94) forwards",
                    }}
                />
            )}
        </>
    );
}
