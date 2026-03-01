/**
 * useSwipeGesture — detects horizontal trackpad swipe gestures.
 *
 * Two complementary strategies are used to handle cross-platform differences:
 *
 * Strategy A — Wheel events (macOS / Windows)
 *   Trackpads on macOS and Windows fire WheelEvents with deltaX when the user
 *   does a two-finger horizontal swipe. deltaMode is 0 (pixels).
 *
 * Strategy B — Pointer capture (Linux / GTK fallback)
 *   On Linux, GTK/X11 intercepts large horizontal wheel deltas and converts
 *   them to scroll actions before they reach the webview. As a result, deltaX
 *   values are small or zero. We supplement with a pointermove tracker that
 *   uses setPointerCapture so the gesture is detected even when the pointer
 *   leaves the element during the swipe.
 *
 * deltaMode normalization:
 *   Linux sends deltaMode=1 (lines, ~16px each) instead of deltaMode=0 (pixels).
 *   We multiply line-based deltas by LINE_HEIGHT so thresholds stay consistent.
 */

import { useEffect, useRef } from "react";

const LINE_HEIGHT = 16; // px per line for deltaMode=1 normalization

interface SwipeGestureOptions {
    /** Minimum accumulated horizontal delta to trigger a swipe (px). Default 50 */
    threshold?: number;
    /** How long to accumulate events before deciding direction (ms). Default 80 */
    accumulateMs?: number;
    /** How long to wait before allowing another swipe (ms). Default 600 */
    cooldownMs?: number;
    /** deltaX must be this many times larger than deltaY to count as horizontal. Default 1.2 */
    axisRatio?: number;
    /** Minimum pointer travel distance for the pointer fallback strategy (px). Default 40 */
    pointerThreshold?: number;
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
        threshold = 50,
        accumulateMs = 80,
        cooldownMs = 600,
        axisRatio = 1.2,
        pointerThreshold = 40,
        onSwipeRight,
        onSwipeLeft,
        enabled = true,
    } = options;

    // Keep latest callbacks in refs so the effect doesn't re-subscribe on every render
    const onSwipeRightRef = useRef(onSwipeRight);
    const onSwipeLeftRef = useRef(onSwipeLeft);
    useEffect(() => {
        onSwipeRightRef.current = onSwipeRight;
        onSwipeLeftRef.current = onSwipeLeft;
    });

    useEffect(() => {
        if (!enabled) return;

        const el: HTMLElement | Window | null =
            target === "window" ? window : target.current;
        if (!el) return;

        let lastFiredAt = 0;

        const tryFire = (deltaX: number) => {
            const now = Date.now();
            if (now - lastFiredAt < cooldownMs) return;
            lastFiredAt = now;
            if (deltaX > 0) {
                onSwipeRightRef.current?.();
            } else {
                onSwipeLeftRef.current?.();
            }
        };

        // ── Strategy A: Wheel events ──────────────────────────────────────────
        let accumulatedX = 0;
        let accumulatedY = 0;
        let accumulateTimer: ReturnType<typeof setTimeout> | null = null;

        const handleWheel = (e: WheelEvent) => {
            // Normalize deltaMode: Linux sends deltaMode=1 (lines), others send 0 (pixels)
            const factor = e.deltaMode === 1 ? LINE_HEIGHT : 1;
            const dx = e.deltaX * factor;
            const dy = e.deltaY * factor;

            accumulatedX += dx;
            accumulatedY += dy;

            if (accumulateTimer !== null) clearTimeout(accumulateTimer);

            accumulateTimer = setTimeout(() => {
                const absX = Math.abs(accumulatedX);
                const absY = Math.abs(accumulatedY);

                if (absX >= threshold && absX > absY * axisRatio) {
                    tryFire(accumulatedX);
                }

                accumulatedX = 0;
                accumulatedY = 0;
                accumulateTimer = null;
            }, accumulateMs);
        };

        // ── Strategy B: Pointer capture (Linux GTK fallback) ─────────────────
        // Track touch-like pointer gestures as a second detection path.
        // Using setPointerCapture ensures we keep getting events even if the
        // pointer moves outside the element during the swipe.
        let pointerStartX = 0;
        let pointerStartY = 0;
        let trackingPointerId: number | null = null;

        const handlePointerDown = (e: PointerEvent) => {
            // Only track touch or stylus (not mouse — mouse swipes are intentional clicks)
            if (e.pointerType === "mouse") return;
            pointerStartX = e.clientX;
            pointerStartY = e.clientY;
            trackingPointerId = e.pointerId;
            (e.currentTarget as HTMLElement)?.setPointerCapture(e.pointerId);
        };

        const handlePointerUp = (e: PointerEvent) => {
            if (trackingPointerId === null || e.pointerId !== trackingPointerId)
                return;
            trackingPointerId = null;

            const dx = e.clientX - pointerStartX;
            const dy = e.clientY - pointerStartY;
            const absX = Math.abs(dx);
            const absY = Math.abs(dy);

            if (absX >= pointerThreshold && absX > absY * axisRatio) {
                tryFire(dx);
            }
        };

        const handlePointerCancel = () => {
            trackingPointerId = null;
        };

        el.addEventListener("wheel", handleWheel as EventListener, {
            passive: true,
        });

        // Pointer events only make sense on an element (not window)
        if (el instanceof HTMLElement) {
            el.addEventListener(
                "pointerdown",
                handlePointerDown as EventListener,
            );
            el.addEventListener("pointerup", handlePointerUp as EventListener);
            el.addEventListener(
                "pointercancel",
                handlePointerCancel as EventListener,
            );
        }

        return () => {
            el.removeEventListener("wheel", handleWheel as EventListener);
            if (el instanceof HTMLElement) {
                el.removeEventListener(
                    "pointerdown",
                    handlePointerDown as EventListener,
                );
                el.removeEventListener(
                    "pointerup",
                    handlePointerUp as EventListener,
                );
                el.removeEventListener(
                    "pointercancel",
                    handlePointerCancel as EventListener,
                );
            }
            if (accumulateTimer !== null) clearTimeout(accumulateTimer);
        };
    }, [
        enabled,
        threshold,
        accumulateMs,
        cooldownMs,
        axisRatio,
        pointerThreshold,
        target,
    ]);
}
