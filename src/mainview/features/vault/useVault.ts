/**
 * useVault — React hook for Resource Vault state management
 * Handles CRUD, filtering, link preview refresh, and AI-assisted input
 */
import { useCallback, useEffect, useRef, useState } from "react";
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
    const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Clean up pending timers on unmount
    useEffect(() => {
        return () => {
            if (previewTimerRef.current) {
                clearTimeout(previewTimerRef.current);
            }
        };
    }, []);

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

                // Only insert optimistically if it matches the current filter
                if (activeFilter === "all" || activeFilter === params.type) {
                    setResources((prev) => [newResource, ...prev]);
                }

                // For links, fetch preview after a delay then reload from server
                if (params.type === "link" && params.url) {
                    if (previewTimerRef.current) {
                        clearTimeout(previewTimerRef.current);
                    }
                    previewTimerRef.current = setTimeout(
                        () => void loadResources(),
                        2000,
                    );
                }
            } catch (err: unknown) {
                console.error("[Vault] Failed to add resource:", err);
            }
        },
        [projectId, activeFilter, loadResources],
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
                await updateVaultResource({ id, ...updates });
                // Reload from server to respect filter + ordering
                await loadResources();
            } catch (err: unknown) {
                console.error("[Vault] Failed to edit resource:", err);
            }
        },
        [loadResources],
    );

    const removeResource = useCallback(async (id: string) => {
        try {
            await deleteVaultResource(id);
            setResources((prev) => prev.filter((r) => r.id !== id));
        } catch (err: unknown) {
            console.error("[Vault] Failed to delete resource:", err);
        }
    }, []);

    const togglePin = useCallback(
        async (id: string) => {
            try {
                await toggleVaultResourcePin(id);
                // Reload to get correct pinned-first ordering
                await loadResources();
            } catch (err: unknown) {
                console.error("[Vault] Failed to toggle pin:", err);
            }
        },
        [loadResources],
    );

    // ─── Link preview ────────────────────────────────────────────────────
    const refreshLinkPreview = useCallback(
        async (
            resourceId: string,
            url: string,
        ): Promise<LinkPreview | null> => {
            try {
                const preview = await fetchLinkPreview(url);

                if (preview) {
                    setResources((prev) =>
                        prev.map((resource) =>
                            resource.id === resourceId
                                ? { ...resource, linkPreview: preview }
                                : resource,
                        ),
                    );
                }

                return preview;
            } catch (err: unknown) {
                console.error("[Vault] Link preview failed:", err);
                return null;
            }
        },
        [],
    );

    // ─── AI enhance ──────────────────────────────────────────────────────
    const aiEnhanceInput = useCallback(
        async (
            rawInput: string,
        ): Promise<{
            type: VaultResourceType;
            title: string;
            content: string;
            tags: string[];
        } | null> => {
            try {
                const response = await queryAI(
                    `You are a smart resource categorizer. Given the following raw input, determine the best resource type and structure it.

Input: "${rawInput}"

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "type": "link" | "note" | "milestone" | "idea" | "decision" | "image",
  "title": "A clear, concise title",
  "content": "Expanded description or summary",
  "tags": ["relevant", "tags"]
}

Rules:
- If it's a URL, type should be "link"
- If it looks like a goal or achievement, use "milestone"
- If it's a creative thought, use "idea"
- If it's a choice or resolution, use "decision"
- If it references an image URL (ending in .png, .jpg, .gif, etc.), use "image"
- Otherwise default to "note"`,
                );

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
                    "image",
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
        refreshLinkPreview,
        aiEnhanceInput,
        refresh: loadResources,
    };
}
