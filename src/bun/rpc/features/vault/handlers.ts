/**
 * Vault RPC handlers — CRUD for Resource Vault + link preview
 */
import type { Database } from "bun:sqlite";
import type { VaultResourceType } from "../../../../shared/types.ts";
import {
    deleteVaultResource,
    getVaultResources,
    insertVaultResource,
    toggleVaultResourcePin,
    updateVaultResource,
    updateVaultResourceLinkPreview,
} from "../../../db/queries.ts";
import { fetchLinkPreview } from "../../../services/link-preview.ts";

export interface VaultHandlersDeps {
    db: Database;
}

const VALID_VAULT_TYPES: ReadonlySet<string> = new Set([
    "link",
    "note",
    "milestone",
    "idea",
    "decision",
    "image",
    "blocker",
]);

function isValidVaultType(type: string): type is VaultResourceType {
    return VALID_VAULT_TYPES.has(type);
}

function isValidUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
}

export function createVaultHandlers(deps: VaultHandlersDeps) {
    const { db } = deps;

    return {
        getVaultResources: async ({
            projectId,
            type,
        }: {
            projectId: string;
            type?: VaultResourceType;
        }) => {
            if (type !== undefined && !isValidVaultType(type)) {
                return [];
            }
            return getVaultResources(db, projectId, type);
        },

        addVaultResource: async ({
            projectId,
            type,
            title,
            content,
            url,
        }: {
            projectId: string;
            type: VaultResourceType;
            title: string;
            content: string;
            url?: string;
        }) => {
            if (!isValidVaultType(type)) {
                throw new Error(`Invalid vault resource type: "${type}"`);
            }

            // For link/image types, validate that URL is http/https (or data: for images)
            if (type === "link" && url && !isValidUrl(url)) {
                throw new Error(
                    "Link resources require a valid http/https URL",
                );
            }
            if (
                type === "image" &&
                url &&
                !isValidUrl(url) &&
                !url.startsWith("data:image/")
            ) {
                throw new Error(
                    "Image resources require a valid URL or data URI",
                );
            }

            const resource = insertVaultResource(
                db,
                projectId,
                type,
                title,
                content,
                url,
            );

            // For links, fetch OG preview asynchronously (don't block the response)
            if (type === "link" && url) {
                fetchLinkPreview(url)
                    .then((preview) => {
                        if (preview) {
                            updateVaultResourceLinkPreview(
                                db,
                                resource.id,
                                preview,
                            );
                        }
                    })
                    .catch((err: unknown) => {
                        console.error(
                            "[Vault] Link preview fetch failed:",
                            err,
                        );
                    });
            }

            return resource;
        },

        updateVaultResource: async ({
            id,
            title,
            content,
            type,
        }: {
            id: string;
            title?: string;
            content?: string;
            type?: VaultResourceType;
        }) => {
            if (type !== undefined && !isValidVaultType(type)) {
                throw new Error(`Invalid vault resource type: "${type}"`);
            }
            const success = updateVaultResource(db, id, {
                title,
                content,
                type,
            });
            return { success };
        },

        deleteVaultResource: async ({ id }: { id: string }) => {
            const success = deleteVaultResource(db, id);
            return { success };
        },

        toggleVaultResourcePin: async ({ id }: { id: string }) => {
            return toggleVaultResourcePin(db, id);
        },

        fetchLinkPreview: async ({ url }: { url: string }) => {
            return fetchLinkPreview(url);
        },
    };
}
