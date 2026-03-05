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
    }) => Promise<void>;
    editResource: (
        id: string,
        updates: {
            title?: string;
            content?: string;
            type?: VaultResourceType;
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
        } | null> => {
            try {
                const response = await queryAI(
                    `You are an expert technical project assistant. Your task is to categorize a developer's raw thought and generate a highly concise, descriptive title.

Input:
"""
${rawInput}
"""

Instructions:
1. Determine the most accurate category from the permitted list.
2. Generate a clear, specific title (maximum 50 characters). Do not use generic titles like "New Idea" or "Bug Report". Extract the core subject.

Respond STRICTLY with ONLY a valid JSON object. No markdown code blocks, no backticks, no explanations.
{
  "type": "note" | "milestone" | "idea" | "decision" | "blocker",
  "title": "Specific, concise title"
}

Category Guidelines:
- "milestone": Deadlines, version goals, or significant achievements.
- "idea": Potential features, "what if" scenarios, or improvements.
- "decision": Architectural choices, conventions, or resolved debates.
- "blocker": Bugs, broken features, or obstacles preventing progress.
- "note": General facts, commands, or anything else.`,
                );

                // Aggressive JSON extraction to handle rogue markdown or conversational filler
                const cleanedResponse = response
                    .replace(/```(?:json)?\n?/gi, "")
                    .replace(/```/g, "")
                    .trim();
                const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);

                if (!jsonMatch) {
                    console.warn(
                        "[Vault] AI response did not contain JSON:",
                        response,
                    );
                    return null;
                }

                let parsed: {
                    type?: VaultResourceType;
                    content?: string;
                    title?: string;
                } | null = null;
                try {
                    parsed = JSON.parse(jsonMatch[0]);
                } catch (_e) {
                    console.error(
                        "[Vault] Failed to parse AI JSON:",
                        jsonMatch[0],
                    );
                }

                if (!parsed) {
                    return null;
                }

                const validTypes = [
                    "note",
                    "milestone",
                    "idea",
                    "decision",
                    "blocker",
                ];

                const type = validTypes.includes(
                    parsed.type?.toLowerCase() ?? "",
                )
                    ? (parsed.type?.toLowerCase() as VaultResourceType)
                    : "note";

                // Clean up title: remove accidental quotes, fallback to first line if missing
                let title =
                    parsed.title?.replace(/^["']|["']$/g, "").trim() ||
                    rawInput.split("\n")[0].trim();
                if (title.length > 80) {
                    title = title.slice(0, 77) + "...";
                }

                return {
                    type,
                    title,
                    content: rawInput, // Strict verbatim content
                };
            } catch (err) {
                console.error("[Vault] AI enhancement failed:", err);
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
