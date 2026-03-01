/**
 * useSwipeGesture — detects horizontal trackpad swipe gestures via wheel events.
 *
 * Trackpads fire WheelEvents with deltaX when the user does a two-finger
 * horizontal swipe (the same gesture browsers use for back/forward navigation).
 *
 * Strategy:
 * - Accumulate deltaX over a short window (ACCUMULATE_MS)
 * - Only fire when accumulated delta exceeds THRESHOLD and the gesture is
 *   primarily horizontal (|deltaX| > |deltaY| * AXIS_RATIO)
 * - Cooldown after firing prevents double-triggers (COOLDOWN_MS)
 */

import { useEffect, useRef } from "react";

interface SwipeGestureOptions {
    /** Minimum accumulated horizontal delta to trigger a swipe (px). Default 60 */
    threshold?: number;
    /** How long to accumulate wheel events before deciding direction (ms). Default 80 */
    accumulateMs?: number;
    /** How long to wait before allowing another swipe (ms). Default 600 */
    cooldownMs?: number;
    /** deltaX must be this many times larger than deltaY to count as horizontal. Default 1.5 */
    axisRatio?: number;
    /** Called when user swipes right (two-finger swipe right = go back) */
    onSwipeRight?: () => void;
    /** Called when user swipes left (two-finger swipe left = go forward) */
    onSwipeLeft?: () => void;
    /** Set to false to disable the gesture listener entirely */
    enabled?: boolean;
}

export function useSwipeGesture(
    target: React.RefObject<HTMLElement | null> | "window",
    options: SwipeGestureOptions = {},
): void {
    const {
        threshold = 60,
        accumulateMs = 80,
        cooldownMs = 600,
        axisRatio = 1.5,
        onSwipeRight,
        onSwipeLeft,
        enabled = true,
    } = options;

    // Keep latest callbacks in refs so the effect doesn't need to re-subscribe
    const onSwipeRightRef = useRef(onSwipeRight);
    const onSwipeLeftRef = useRef(onSwipeLeft);
    useEffect(() => {
        onSwipeRightRef.current = onSwipeRight;
        onSwipeLeftRef.current = onSwipeLeft;
    });

    useEffect(() => {
        if (!enabled) return;

        let accumulatedX = 0;
        let accumulatedY = 0;
        let accumulateTimer: ReturnType<typeof setTimeout> | null = null;
        let lastFiredAt = 0;

        const handleWheel = (e: WheelEvent) => {
            // Only care about trackpad-style events (non-integer deltaY is a
            // strong signal for a physical trackpad vs. a scroll wheel)
            const now = Date.now();
            if (now - lastFiredAt < cooldownMs) return;

            accumulatedX += e.deltaX;
            accumulatedY += e.deltaY;

            if (accumulateTimer !== null) {
                clearTimeout(accumulateTimer);
            }

            accumulateTimer = setTimeout(() => {
                const absX = Math.abs(accumulatedX);
                const absY = Math.abs(accumulatedY);

                // Must be clearly horizontal and exceed threshold
                if (absX >= threshold && absX > absY * axisRatio) {
                    lastFiredAt = Date.now();
                    if (accumulatedX > 0) {
                        // Swiped left-to-right → "swipe right" = go back
                        onSwipeRightRef.current?.();
                    } else {
                        // Swiped right-to-left → "swipe left" = go forward
                        onSwipeLeftRef.current?.();
                    }
                }

                accumulatedX = 0;
                accumulatedY = 0;
                accumulateTimer = null;
            }, accumulateMs);
        };

        const el = target === "window" ? window : target.current;

        if (!el) return;

        el.addEventListener("wheel", handleWheel as EventListener, {
            passive: true,
        });

        return () => {
            el.removeEventListener("wheel", handleWheel as EventListener);
            if (accumulateTimer !== null) clearTimeout(accumulateTimer);
        };
    }, [enabled, threshold, accumulateMs, cooldownMs, axisRatio, target]);
}
