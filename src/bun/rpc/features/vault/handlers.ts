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
            return getVaultResources(db, projectId, type);
        },

        addVaultResource: async ({
            projectId,
            type,
            title,
            content,
            url,
            tags,
        }: {
            projectId: string;
            type: VaultResourceType;
            title: string;
            content: string;
            url?: string;
            tags?: string[];
        }) => {
            const resource = insertVaultResource(
                db,
                projectId,
                type,
                title,
                content,
                url,
                tags,
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
            tags,
        }: {
            id: string;
            title?: string;
            content?: string;
            type?: VaultResourceType;
            tags?: string[];
        }) => {
            const success = updateVaultResource(db, id, {
                title,
                content,
                type,
                tags,
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
