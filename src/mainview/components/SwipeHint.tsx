/**
 * SwipeHint — subtle animated edge arrows that indicate swipe navigation is available.
 *
 * Shows a translucent chevron on the left and/or right edge of the content area.
 * The hints briefly appear on mount (to teach the gesture) then fade out,
 * and re-appear on hover near the edges.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";

interface SwipeHintProps {
    /** Show the left arrow (swipe right = go back) */
    showLeft?: boolean;
    /** Show the right arrow (swipe left = go forward) */
    showRight?: boolean;
    /** Label shown on hover for the left arrow */
    leftLabel?: string;
    /** Label shown on hover for the right arrow */
    rightLabel?: string;
}

export default function SwipeHint({
    showLeft = false,
    showRight = false,
    leftLabel = "Go back",
    rightLabel = "Go forward",
}: SwipeHintProps) {
    if (!showLeft && !showRight) return null;

    return (
        <>
            {/* Left edge hint */}
            {showLeft && (
                <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-50 pointer-events-none
                                flex items-center group/left
                                animate-in fade-in slide-in-from-left-2 duration-500"
                >
                    <div
                        className="flex items-center gap-1 ml-2
                                    opacity-0 hover:opacity-100
                                    [animation:swipe-hint-pulse_3s_ease-in-out_1]"
                    >
                        <div
                            className="flex items-center gap-1 px-2 py-1.5 rounded-full
                                        bg-mac-surface/60 backdrop-blur-md border border-mac-border/50
                                        shadow-mac text-mac-secondary"
                        >
                            <ChevronLeft className="w-3.5 h-3.5 text-mac-accent" />
                            <span className="text-[11px] font-medium hidden group-hover/left:block">
                                {leftLabel}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Right edge hint */}
            {showRight && (
                <div
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-50 pointer-events-none
                                flex items-center
                                animate-in fade-in slide-in-from-right-2 duration-500"
                >
                    <div
                        className="flex items-center gap-1 mr-2
                                    opacity-0 hover:opacity-100
                                    [animation:swipe-hint-pulse_3s_ease-in-out_1]"
                    >
                        <div
                            className="flex items-center gap-1 px-2 py-1.5 rounded-full
                                        bg-mac-surface/60 backdrop-blur-md border border-mac-border/50
                                        shadow-mac text-mac-secondary"
                        >
                            <span className="text-[11px] font-medium hidden group-hover/right:block">
                                {rightLabel}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-mac-accent" />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
