/**
 * useSwipeGesture — browser-style trackpad swipe navigation.
 *
 * Behaviour mirrors Chrome's back/forward swipe:
 *   - Icon appears and follows the drag as you move fingers
 *   - Navigation fires when fingers lift (gesture settles)
 *   - If drag wasn't far enough, icon snaps back without navigating
 *
 * Strategy: Wheel events (macOS / Windows trackpads fire deltaX in pixel mode)
 *
 * onSwiping callback:
 *   Called continuously with progress (-1 to 1, 0 = idle/reset)
 * onSwipeCommit callback:
 *   Called when user lifts fingers and threshold was met — do the navigation
 */

import { useEffect, useRef } from "react";

interface SwipeGestureOptions {
    /** Minimum accumulated horizontal delta to commit navigation (px). Default 60 */
    threshold?: number;
    /** ms of no wheel events before we consider fingers lifted. Default 80 */
    settleMs?: number;
    /** How long to wait before allowing another swipe (ms). Default 500 */
    cooldownMs?: number;
    /** deltaX must be this many times larger than deltaY. Default 1.5 */
    axisRatio?: number;
    /** Called during drag with progress value (-1 to 1), then 0 on snap-back (no commit) */
    onSwiping?: (progress: number) => void;
    /** Called when swipe is committed (fingers lifted, threshold met) */
    onSwipeRight?: () => void;
    onSwipeLeft?: () => void;
    /** Set to false to disable entirely */
    enabled?: boolean;
}

export function useSwipeGesture(
    _target: React.RefObject<HTMLElement | null> | "window",
    options: SwipeGestureOptions = {},
): void {
    const {
        threshold = 20,
        settleMs = 10,
        cooldownMs = 200,
        axisRatio = 1.5,
        onSwipeRight,
        onSwipeLeft,
        onSwiping,
        enabled = true,
    } = options;

    const onSwipeRightRef = useRef(onSwipeRight);
    const onSwipeLeftRef = useRef(onSwipeLeft);
    const onSwipingRef = useRef(onSwiping);
    useEffect(() => {
        onSwipeRightRef.current = onSwipeRight;
        onSwipeLeftRef.current = onSwipeLeft;
        onSwipingRef.current = onSwiping;
    });

    useEffect(() => {
        if (!enabled) return;

        let accumulatedX = 0;
        let accumulatedY = 0;
        let lastFiredAt = 0;
        let settleTimer: ReturnType<typeof setTimeout> | null = null;
        let isTracking = false;

        const commit = () => {
            const aX = Math.abs(accumulatedX);
            const aY = Math.abs(accumulatedY);
            const didCross = aX >= threshold && aX > aY * axisRatio;
            const now = Date.now();
            const offCooldown = now - lastFiredAt >= cooldownMs;

            if (didCross && offCooldown) {
                lastFiredAt = now;
                const dir = accumulatedX;
                // Navigation committed — caller resets progress via onSwipeRight/Left
                // Do NOT call onSwiping(0) here so the caller can distinguish commit vs snap-back
                if (dir > 0) {
                    onSwipeRightRef.current?.();
                } else {
                    onSwipeLeftRef.current?.();
                }
            } else {
                // Snap back — not far enough or on cooldown
                onSwipingRef.current?.(0);
            }

            accumulatedX = 0;
            accumulatedY = 0;
            isTracking = false;
            settleTimer = null;
        };

        const handleWheel = (e: WheelEvent) => {
            const dx = e.deltaX;
            const dy = e.deltaY;

            // Ignore pure vertical scrolls early
            if (Math.abs(dy) > Math.abs(dx) * axisRatio && !isTracking) return;

            accumulatedX += dx;
            accumulatedY += dy;

            const absX = Math.abs(accumulatedX);
            const absY = Math.abs(accumulatedY);

            // Only track if horizontal dominates
            if (absX > absY * axisRatio || isTracking) {
                isTracking = true;
                // Clamp to [-1, 1] and report live drag progress
                const progress = Math.max(
                    -1,
                    Math.min(accumulatedX / threshold, 1),
                );
                onSwipingRef.current?.(progress);
            }

            // Reset settle timer — fires when fingers lift
            if (settleTimer !== null) clearTimeout(settleTimer);
            settleTimer = setTimeout(commit, settleMs);
        };

        window.addEventListener("wheel", handleWheel, { passive: true });

        return () => {
            window.removeEventListener("wheel", handleWheel);
            if (settleTimer !== null) clearTimeout(settleTimer);
        };
    }, [enabled, threshold, settleMs, cooldownMs, axisRatio]);
}
