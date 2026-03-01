/**
 * useSwipeGesture — detects horizontal trackpad swipe gestures.
 *
 * Listens on window so that inner scrollable elements don't swallow
 * the wheel events before they reach the handler.
 *
 * Strategy: Wheel events (macOS / Windows)
 *   Trackpads fire WheelEvents with deltaX. deltaMode is 0 (pixels).
 *
 * onSwiping callback:
 *   Called continuously during a swipe with the current progress (-1 to 1)
 *   so the UI can show a live hint. Fires with 0 when swipe ends.
 */

import { useEffect, useRef } from "react";

interface SwipeGestureOptions {
    /** Minimum accumulated horizontal delta to trigger a swipe (px). Default 50 */
    threshold?: number;
    /** How long to accumulate events before deciding direction (ms). Default 80 */
    accumulateMs?: number;
    /** How long to wait before allowing another swipe (ms). Default 600 */
    cooldownMs?: number;
    /** deltaX must be this many times larger than deltaY. Default 1.2 */
    axisRatio?: number;
    /** Called during swipe with progress value (-1 to 1), then 0 on completion */
    onSwiping?: (progress: number) => void;
    /** Called when user swipes right */
    onSwipeRight?: () => void;
    /** Called when user swipes left */
    onSwipeLeft?: () => void;
    /** Set to false to disable entirely */
    enabled?: boolean;
}

export function useSwipeGesture(
    _target: React.RefObject<HTMLElement | null> | "window",
    options: SwipeGestureOptions = {},
): void {
    const {
        threshold = 50,
        accumulateMs = 80,
        cooldownMs = 600,
        axisRatio = 1.2,
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

        let lastFiredAt = 0;

        const tryFire = (deltaX: number) => {
            const now = Date.now();
            if (now - lastFiredAt < cooldownMs) return;
            lastFiredAt = now;
            onSwipingRef.current?.(0);
            if (deltaX > 0) {
                onSwipeRightRef.current?.();
            } else {
                onSwipeLeftRef.current?.();
            }
        };

        let accumulatedX = 0;
        let accumulatedY = 0;
        let accumulateTimer: ReturnType<typeof setTimeout> | null = null;

        const handleWheel = (e: WheelEvent) => {
            const dx = e.deltaX;
            const dy = e.deltaY;

            accumulatedX += dx;
            accumulatedY += dy;

            // Report live progress for UI hint
            const absX = Math.abs(accumulatedX);
            const absY = Math.abs(accumulatedY);
            if (absX > absY * axisRatio) {
                const progress = Math.min(accumulatedX / threshold, 1);
                onSwipingRef.current?.(progress);
            }

            if (accumulateTimer !== null) clearTimeout(accumulateTimer);
            accumulateTimer = setTimeout(() => {
                const aX = Math.abs(accumulatedX);
                const aY = Math.abs(accumulatedY);
                if (aX >= threshold && aX > aY * axisRatio) {
                    tryFire(accumulatedX);
                } else {
                    // Not a swipe — reset hint
                    onSwipingRef.current?.(0);
                }
                accumulatedX = 0;
                accumulatedY = 0;
                accumulateTimer = null;
            }, accumulateMs);
        };

        // Listen on window so inner scrollable divs don't block the event
        window.addEventListener("wheel", handleWheel, { passive: true });

        return () => {
            window.removeEventListener("wheel", handleWheel);
            if (accumulateTimer !== null) clearTimeout(accumulateTimer);
        };
    }, [enabled, threshold, accumulateMs, cooldownMs, axisRatio]);
}
