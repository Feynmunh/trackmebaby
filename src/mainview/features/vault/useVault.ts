/**
 * useVault — React hook for Resource Vault state management
 * Handles CRUD, filtering, link preview refresh, and AI-assisted input
 */
import { useCallback, useEffect, useState } from "react";
import type {
    LinkPreview,
    VaultResource,
    VaultResourceType,
} from "../../../shared/types.ts";
import {
    addVaultResource,
    deleteVaultResource,
    fetchLinkPreview,
    getVaultResources,
    queryAI,
    toggleVaultResourcePin,
    updateVaultResource,
} from "../../rpc.ts";

interface UseVaultReturn {
    resources: VaultResource[];
    pinnedResources: VaultResource[];
    unpinnedResources: VaultResource[];
    isLoading: boolean;
    activeFilter: VaultResourceType | "all";
    setActiveFilter: (filter: VaultResourceType | "all") => void;
    addResource: (params: {
        type: VaultResourceType;
        title: string;
        content: string;
        url?: string;
        tags?: string[];
    }) => Promise<void>;
    editResource: (
        id: string,
        updates: {
            title?: string;
            content?: string;
            type?: VaultResourceType;
            tags?: string[];
        },
    ) => Promise<void>;
    removeResource: (id: string) => Promise<void>;
    togglePin: (id: string) => Promise<void>;
    refreshLinkPreview: (
        resourceId: string,
        url: string,
    ) => Promise<LinkPreview | null>;
    aiEnhanceInput: (rawInput: string) => Promise<{
        type: VaultResourceType;
        title: string;
        content: string;
        tags: string[];
    } | null>;
    refresh: () => Promise<void>;
}

export function useVault(projectId: string): UseVaultReturn {
    const [resources, setResources] = useState<VaultResource[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<VaultResourceType | "all">(
        "all",
    );

    // ─── Load resources ──────────────────────────────────────────────────
    const loadResources = useCallback(async () => {
        try {
            const type = activeFilter === "all" ? undefined : activeFilter;
            const data = await getVaultResources(projectId, type);
            setResources(data);
        } catch (err: unknown) {
            console.error("[Vault] Failed to load resources:", err);
        } finally {
            setIsLoading(false);
        }
    }, [projectId, activeFilter]);

    useEffect(() => {
        setIsLoading(true);
        void loadResources();
    }, [loadResources]);

    // ─── Derived state ───────────────────────────────────────────────────
    const pinnedResources = resources.filter((r) => r.isPinned);
    const unpinnedResources = resources.filter((r) => !r.isPinned);

    // ─── CRUD ────────────────────────────────────────────────────────────
    const addResource = useCallback(
        async (params: {
            type: VaultResourceType;
            title: string;
            content: string;
            url?: string;
            tags?: string[];
        }) => {
            try {
                const newResource = await addVaultResource({
                    projectId,
                    ...params,
                });
                setResources((prev) => [newResource, ...prev]);

                // For links, fetch preview after a short delay and refresh
                if (params.type === "link" && params.url) {
                    setTimeout(() => void loadResources(), 2000);
                }
            } catch (err: unknown) {
                console.error("[Vault] Failed to add resource:", err);
            }
        },
        [projectId, loadResources],
    );

    const editResource = useCallback(
        async (
            id: string,
            updates: {
                title?: string;
                content?: string;
                type?: VaultResourceType;
                tags?: string[];
            },
        ) => {
            try {
                const { success } = await updateVaultResource({
                    id,
                    ...updates,
                });
                if (success) {
                    setResources((prev) =>
                        prev.map((r) =>
                            r.id === id ? { ...r, ...updates } : r,
                        ),
                    );
                }
            } catch (err: unknown) {
                console.error("[Vault] Failed to update resource:", err);
            }
        },
        [],
    );

    const removeResource = useCallback(async (id: string) => {
        try {
            const { success } = await deleteVaultResource(id);
            if (success) {
                setResources((prev) => prev.filter((r) => r.id !== id));
            }
        } catch (err: unknown) {
            console.error("[Vault] Failed to delete resource:", err);
        }
    }, []);

    const togglePin = useCallback(async (id: string) => {
        try {
            const result = await toggleVaultResourcePin(id);
            if (result.success) {
                setResources((prev) =>
                    prev.map((r) =>
                        r.id === id ? { ...r, isPinned: result.isPinned } : r,
                    ),
                );
            }
        } catch (err: unknown) {
            console.error("[Vault] Failed to toggle pin:", err);
        }
    }, []);

    const refreshLinkPrev = useCallback(
        async (
            resourceId: string,
            url: string,
        ): Promise<LinkPreview | null> => {
            try {
                const preview = await fetchLinkPreview(url);
                if (preview) {
                    setResources((prev) =>
                        prev.map((r) =>
                            r.id === resourceId
                                ? { ...r, linkPreview: preview }
                                : r,
                        ),
                    );
                }
                return preview;
            } catch {
                return null;
            }
        },
        [],
    );

    // ─── AI enhance ──────────────────────────────────────────────────────
    const aiEnhanceInput = useCallback(
        async (rawInput: string) => {
            try {
                const prompt = `You are an assistant that helps organize project resources. The user typed the following input for their Resource Vault:

"${rawInput}"

Classify this into one of these types: link, note, milestone, idea, decision
Then structure it as JSON with these fields:
- type: one of "link", "note", "milestone", "idea", "decision"
- title: a clear short title (max 60 chars)
- content: the full structured content
- tags: an array of 1-3 relevant short tags

Return ONLY valid JSON, no markdown, no explanation.`;

                const response = await queryAI(prompt, {
                    task: "general",
                    projectId,
                });

                // Try to parse JSON from the response
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (!jsonMatch) return null;

                const parsed = JSON.parse(jsonMatch[0]) as {
                    type?: string;
                    title?: string;
                    content?: string;
                    tags?: string[];
                };

                const validTypes = [
                    "link",
                    "note",
                    "milestone",
                    "idea",
                    "decision",
                ];
                const type = validTypes.includes(parsed.type ?? "")
                    ? (parsed.type as VaultResourceType)
                    : "note";

                return {
                    type,
                    title: parsed.title || rawInput.slice(0, 60),
                    content: parsed.content || rawInput,
                    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
                };
            } catch {
                return null;
            }
        },
        [projectId],
    );

    return {
        resources,
        pinnedResources,
        unpinnedResources,
        isLoading,
        activeFilter,
        setActiveFilter,
        addResource,
        editResource,
        removeResource,
        togglePin,
        refreshLinkPreview: refreshLinkPrev,
        aiEnhanceInput,
        refresh: loadResources,
    };
}
