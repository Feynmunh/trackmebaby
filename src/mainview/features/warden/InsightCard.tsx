import { useState } from "react";
import type {
    WardenCategory,
    WardenInsight,
    WardenSeverity,
} from "../../../shared/types.ts";

interface InsightCardProps {
    insight: WardenInsight;
    onApprove?: (id: string) => void;
    onDismiss?: (id: string) => void;
    onLike?: (id: string) => void;
}

const CATEGORY_COLORS: Record<WardenCategory, string> = {
    security: "bg-red-500/10 text-red-400",
    tech_debt: "bg-orange-500/10 text-orange-400",
    project_health: "bg-green-500/10 text-green-400",
    suggestion: "bg-blue-500/10 text-blue-400",
    testing_gap: "bg-purple-500/10 text-purple-400",
    deprecation: "bg-yellow-500/10 text-yellow-400",
    dependency: "bg-cyan-500/10 text-cyan-400",
    refactoring: "bg-indigo-500/10 text-indigo-400",
};

const SEVERITY_COLORS: Record<WardenSeverity, string> = {
    critical: "bg-red-500",
    warning: "bg-yellow-500",
    info: "bg-blue-500",
};

export default function InsightCard({
    insight,
    onApprove,
    onDismiss,
    onLike,
}: InsightCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isDismissing, setIsDismissing] = useState(false);

    const formatCategory = (category: string) => {
        return category.split("_").join(" ");
    };

    const handleDismiss = () => {
        if (!onDismiss) return;
        setIsDismissing(true);
        // Small delay to allow opacity transition
        setTimeout(() => {
            onDismiss(insight.id);
        }, 200);
    };

    return (
        <div
            className={`bg-app-surface/40 border border-app-border rounded-xl shadow-app-sm p-3 transition-opacity duration-200 ${isDismissing ? "opacity-0" : "opacity-100"}`}
        >
            <div className="flex items-start gap-3">
                {/* Severity Badge */}
                <div className="mt-2 flex-shrink-0">
                    <div
                        className={`w-2.5 h-2.5 rounded-full shadow-sm ${SEVERITY_COLORS[insight.severity]}`}
                        title={`Severity: ${insight.severity}`}
                        role="img"
                        aria-label={`Severity: ${insight.severity}`}
                    />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Header Row */}
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h3 className="font-semibold text-sm truncate max-w-[70%] text-app-text-main">
                            {insight.title}
                        </h3>
                        <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider whitespace-nowrap ${CATEGORY_COLORS[insight.category]}`}
                        >
                            {formatCategory(insight.category)}
                        </span>
                    </div>

                    {/* Body */}
                    <p className="text-app-text-muted text-sm leading-relaxed mb-3">
                        {insight.description}
                    </p>

                    {/* Affected Files */}
                    {insight.affectedFiles &&
                        insight.affectedFiles.length > 0 && (
                            <div className="mb-2">
                                <button
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    aria-expanded={isExpanded}
                                    aria-controls={`affected-files-${insight.id}`}
                                    className="text-xs text-app-text-muted hover:text-app-text-main transition-colors flex items-center gap-1.5 focus:outline-none"
                                >
                                    <span
                                        className={`inline-block transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                                    >
                                        ▶
                                    </span>
                                    <span>
                                        {insight.affectedFiles.length} file
                                        {insight.affectedFiles.length !== 1
                                            ? "s"
                                            : ""}
                                    </span>
                                </button>

                                {isExpanded && (
                                    <ul
                                        id={`affected-files-${insight.id}`}
                                        className="mt-2 space-y-1 font-mono text-xs text-app-text-muted bg-app-surface/60 border border-app-border/50 rounded-lg p-2 max-h-32 overflow-y-auto"
                                    >
                                        {insight.affectedFiles.map(
                                            (file, idx) => (
                                                <li
                                                    key={idx}
                                                    className="truncate"
                                                    title={file}
                                                >
                                                    {file}
                                                </li>
                                            ),
                                        )}
                                    </ul>
                                )}
                            </div>
                        )}
                </div>
            </div>

            {/* Action Buttons Row */}
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-app-border/40">
                {onApprove && (
                    <button
                        onClick={() => onApprove(insight.id)}
                        aria-label="Approve insight"
                        className="px-2.5 py-1 text-xs font-medium text-green-400 hover:text-green-300 hover:bg-green-400/10 rounded transition-colors"
                    >
                        ✔ Approve
                    </button>
                )}
                {onDismiss && (
                    <button
                        onClick={handleDismiss}
                        aria-label="Dismiss insight"
                        className="px-2.5 py-1 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors"
                    >
                        ✖ Dismiss
                    </button>
                )}
                {onLike && (
                    <button
                        onClick={() => onLike(insight.id)}
                        aria-label="Like insight"
                        className="px-2.5 py-1 text-xs font-medium text-pink-400 hover:text-pink-300 hover:bg-pink-400/10 rounded transition-colors ml-auto"
                    >
                        ❤️ Like
                    </button>
                )}
            </div>
        </div>
    );
}
