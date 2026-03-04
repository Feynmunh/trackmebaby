/**
 * VaultPage — Main Resource Vault view
 * Shows all project resources with filtering, pinned section, and quick-add
 */
import {
    Archive,
    FileText,
    ImageIcon,
    Lightbulb,
    Link2,
    Scale,
    Target,
} from "lucide-react";
import { useState } from "react";
import type {
    VaultResource,
    VaultResourceType,
} from "../../../shared/types.ts";
import AddResourceForm from "./AddResourceForm.tsx";
import { TYPE_EMPTY_LABELS } from "./constants.ts";
import ResourceCard from "./ResourceCard.tsx";
import ResourceDetailModal from "./ResourceDetailModal.tsx";
import { useVault } from "./useVault.ts";

const FILTER_OPTIONS: {
    id: VaultResourceType | "all";
    label: string;
    icon: typeof Link2 | null;
}[] = [
    { id: "all", label: "All", icon: null },
    { id: "link", label: "Links", icon: Link2 },
    { id: "note", label: "Notes", icon: FileText },
    { id: "milestone", label: "Milestones", icon: Target },
    { id: "idea", label: "Ideas", icon: Lightbulb },
    { id: "decision", label: "Decisions", icon: Scale },
    { id: "image", label: "Images", icon: ImageIcon },
];

interface VaultPageProps {
    projectId: string;
}

export default function VaultPage({ projectId }: VaultPageProps) {
    const {
        pinnedResources,
        unpinnedResources,
        isLoading,
        activeFilter,
        setActiveFilter,
        addResource,
        editResource,
        removeResource,
        togglePin,
        aiEnhanceInput,
        resources,
    } = useVault(projectId);

    const [selectedResource, setSelectedResource] =
        useState<VaultResource | null>(null);

    return (
        <div className="mb-12 space-y-4">
            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold text-app-text-muted uppercase tracking-[0.2em] flex items-center gap-1.5">
                    <Archive size={13} strokeWidth={2.2} />
                    Resource Vault
                    {resources.length > 0 && (
                        <span className="ml-1.5 text-[9px] font-bold bg-app-surface-elevated/50 text-app-text-muted/70 px-1.5 py-0.5 rounded-full">
                            {resources.length}
                        </span>
                    )}
                </h3>
            </div>

            {/* ── Quick Add ── */}
            <AddResourceForm onAdd={addResource} onAiEnhance={aiEnhanceInput} />

            {/* ── Filter pills ── */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                {FILTER_OPTIONS.map((filter) => {
                    const isActive = activeFilter === filter.id;
                    const Icon = filter.icon;
                    return (
                        <button
                            key={filter.id}
                            onClick={() => setActiveFilter(filter.id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all border whitespace-nowrap ${
                                isActive
                                    ? "bg-app-accent/15 text-app-accent border-app-accent/25"
                                    : "bg-app-surface/30 text-app-text-muted/70 border-app-border/50 hover:bg-app-surface/50 hover:text-app-text-main"
                            }`}
                        >
                            {Icon && <Icon size={11} />}
                            {filter.label}
                        </button>
                    );
                })}
            </div>

            {/* ── Loading state ── */}
            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <div className="flex gap-1.5 items-center">
                        <span
                            className="w-1.5 h-1.5 rounded-full bg-app-accent/60 animate-bounce"
                            style={{ animationDelay: "0ms" }}
                        />
                        <span
                            className="w-1.5 h-1.5 rounded-full bg-app-accent/60 animate-bounce"
                            style={{ animationDelay: "150ms" }}
                        />
                        <span
                            className="w-1.5 h-1.5 rounded-full bg-app-accent/60 animate-bounce"
                            style={{ animationDelay: "300ms" }}
                        />
                    </div>
                </div>
            )}

            {/* ── Empty state ── */}
            {!isLoading && resources.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-app-surface-elevated/30 border border-app-border/50 flex items-center justify-center mb-4">
                        <Archive size={28} className="text-app-text-muted/30" />
                    </div>
                    <h4 className="text-[14px] font-semibold text-app-text-main/80 mb-1">
                        {activeFilter !== "all"
                            ? TYPE_EMPTY_LABELS[activeFilter]
                            : "Your vault is empty"}
                    </h4>
                    <p className="text-[12px] text-app-text-muted/60 max-w-[280px] leading-relaxed">
                        {activeFilter !== "all"
                            ? "Use the quick-add bar above to create one."
                            : "Start adding links, notes, images, ideas, milestones, and decisions. Paste a URL or type anything above to get started."}
                    </p>
                </div>
            )}

            {/* ── Pinned section ── */}
            {!isLoading && pinnedResources.length > 0 && (
                <div>
                    <h4 className="text-[10px] font-bold text-app-text-muted/50 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <span className="w-3 h-px bg-app-text-muted/20" />
                        Pinned
                        <span className="flex-1 h-px bg-app-text-muted/10" />
                    </h4>
                    {/* Links render as compact list, others as grid */}
                    <div className="flex flex-col gap-2">
                        {pinnedResources
                            .filter((r) => r.type === "link")
                            .map((resource) => (
                                <ResourceCard
                                    key={resource.id}
                                    resource={resource}
                                    onTogglePin={togglePin}
                                    onDelete={removeResource}
                                    onEdit={editResource}
                                    onViewDetails={setSelectedResource}
                                />
                            ))}
                    </div>
                    {pinnedResources.some((r) => r.type !== "link") && (
                        <div className="grid grid-cols-2 gap-3 mt-2">
                            {pinnedResources
                                .filter((r) => r.type !== "link")
                                .map((resource) => (
                                    <ResourceCard
                                        key={resource.id}
                                        resource={resource}
                                        onTogglePin={togglePin}
                                        onDelete={removeResource}
                                        onEdit={editResource}
                                        onViewDetails={setSelectedResource}
                                    />
                                ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Resources ── */}
            {!isLoading && unpinnedResources.length > 0 && (
                <div>
                    {pinnedResources.length > 0 && (
                        <h4 className="text-[10px] font-bold text-app-text-muted/50 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <span className="w-3 h-px bg-app-text-muted/20" />
                            All
                            <span className="flex-1 h-px bg-app-text-muted/10" />
                        </h4>
                    )}
                    {/* Links as compact stacked list */}
                    {unpinnedResources.some((r) => r.type === "link") && (
                        <div className="flex flex-col gap-2 mb-3">
                            {unpinnedResources
                                .filter((r) => r.type === "link")
                                .map((resource) => (
                                    <ResourceCard
                                        key={resource.id}
                                        resource={resource}
                                        onTogglePin={togglePin}
                                        onDelete={removeResource}
                                        onEdit={editResource}
                                        onViewDetails={setSelectedResource}
                                    />
                                ))}
                        </div>
                    )}
                    {/* Images as 2-col gallery */}
                    {unpinnedResources.some((r) => r.type === "image") && (
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            {unpinnedResources
                                .filter((r) => r.type === "image")
                                .map((resource) => (
                                    <ResourceCard
                                        key={resource.id}
                                        resource={resource}
                                        onTogglePin={togglePin}
                                        onDelete={removeResource}
                                        onEdit={editResource}
                                        onViewDetails={setSelectedResource}
                                    />
                                ))}
                        </div>
                    )}
                    {/* Other types as 2-col grid */}
                    {unpinnedResources.some(
                        (r) => r.type !== "link" && r.type !== "image",
                    ) && (
                        <div className="grid grid-cols-2 gap-3">
                            {unpinnedResources
                                .filter(
                                    (r) =>
                                        r.type !== "link" && r.type !== "image",
                                )
                                .map((resource) => (
                                    <ResourceCard
                                        key={resource.id}
                                        resource={resource}
                                        onTogglePin={togglePin}
                                        onDelete={removeResource}
                                        onEdit={editResource}
                                        onViewDetails={setSelectedResource}
                                    />
                                ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Detail modal ── */}
            {selectedResource && (
                <ResourceDetailModal
                    resource={selectedResource}
                    onClose={() => setSelectedResource(null)}
                    onTogglePin={(id) => {
                        togglePin(id);
                        setSelectedResource(null);
                    }}
                    onDelete={(id) => {
                        removeResource(id);
                        setSelectedResource(null);
                    }}
                    onEdit={editResource}
                />
            )}
        </div>
    );
}
