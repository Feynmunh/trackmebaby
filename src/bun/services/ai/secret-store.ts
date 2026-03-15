import type { Database } from "bun:sqlite";
import { secrets } from "bun";
import { createLogger } from "../../../shared/logger.ts";
import { getSetting, setSetting } from "../../db/queries.ts";

const logger = createLogger("ai-secret-store");

export type AISecretStorageMode = "secure" | "local_unencrypted" | "none";

export interface SetApiKeyResult {
    storageMode: AISecretStorageMode;
    keychainAvailable: boolean;
}

export class AISecretStore {
    private db: Database;
    private readonly serviceName = "com.trackmebaby.ai";
    private keychainAvailableCache: boolean | null = null;
    private lastProbeTime = 0;
    private readonly PROBE_TTL = 30000; // 30 seconds

    constructor(db: Database) {
        this.db = db;
    }

    private markKeychainAvailable(now: number = Date.now()): void {
        this.keychainAvailableCache = true;
        this.lastProbeTime = now;
    }

    private markKeychainUnavailable(now: number = Date.now()): void {
        this.keychainAvailableCache = false;
        this.lastProbeTime = now;
    }

    async isKeychainAvailable(): Promise<boolean> {
        if (this.keychainAvailableCache === true) {
            return true;
        }

        const now = Date.now();
        if (
            this.keychainAvailableCache === false &&
            now - this.lastProbeTime < this.PROBE_TTL
        ) {
            return false;
        }

        this.lastProbeTime = now;
        try {
            await secrets.get({
                service: this.serviceName,
                name: "__trackmebaby_probe__",
            });
            this.markKeychainAvailable(now);
            return true;
        } catch {
            this.markKeychainUnavailable(now);
            return false;
        }
    }

    async getApiKey(provider: string): Promise<string> {
        const normalizedProvider = this.normalizeProvider(provider);

        const keychainAvailable = await this.isKeychainAvailable();
        if (!keychainAvailable) {
            const fallbackKey = getSetting(
                this.db,
                this.getFallbackSettingsKey(normalizedProvider),
            );
            return fallbackKey ?? "";
        }

        const keychainResult =
            await this.getApiKeyFromKeychain(normalizedProvider);

        if (keychainResult.ok && keychainResult.value) {
            return keychainResult.value;
        }

        const fallbackKey = getSetting(
            this.db,
            this.getFallbackSettingsKey(normalizedProvider),
        );
        return fallbackKey ?? "";
    }

    async hasApiKey(provider: string): Promise<boolean> {
        const apiKey = await this.getApiKey(provider);
        return apiKey.trim().length > 0;
    }

    async getStorageMode(provider: string): Promise<AISecretStorageMode> {
        const normalizedProvider = this.normalizeProvider(provider);

        const keychainAvailable = await this.isKeychainAvailable();
        if (!keychainAvailable) {
            const fallbackKey = getSetting(
                this.db,
                this.getFallbackSettingsKey(normalizedProvider),
            );
            if (fallbackKey && fallbackKey.trim().length > 0) {
                return "local_unencrypted";
            }
            return "none";
        }

        const keychainResult =
            await this.getApiKeyFromKeychain(normalizedProvider);

        if (keychainResult.ok && keychainResult.value) {
            return "secure";
        }

        const fallbackKey = getSetting(
            this.db,
            this.getFallbackSettingsKey(normalizedProvider),
        );
        if (fallbackKey && fallbackKey.trim().length > 0) {
            return "local_unencrypted";
        }

        return "none";
    }

    async setApiKey(
        provider: string,
        apiKey: string,
    ): Promise<SetApiKeyResult> {
        const normalizedProvider = this.normalizeProvider(provider);
        const trimmedKey = apiKey.trim();
        if (!trimmedKey) {
            await this.clearApiKey(normalizedProvider);
            return {
                storageMode: "none",
                keychainAvailable: await this.isKeychainAvailable(),
            };
        }
        const keychainAvailable = await this.isKeychainAvailable();
        let finalKeychainAvailable = keychainAvailable;

        if (keychainAvailable) {
            try {
                await secrets.set({
                    service: this.serviceName,
                    name: this.getSecretName(normalizedProvider),
                    value: trimmedKey,
                });
                this.markKeychainAvailable();
                setSetting(
                    this.db,
                    this.getFallbackSettingsKey(normalizedProvider),
                    "",
                );
                return {
                    storageMode: "secure",
                    keychainAvailable: true,
                };
            } catch (err: unknown) {
                this.markKeychainUnavailable();
                finalKeychainAvailable = false;
                const message =
                    err instanceof Error ? err.message : String(err);
                logger.warn("keychain set failed, falling back to DB", {
                    error: message,
                    provider: normalizedProvider,
                });
            }
        }

        setSetting(
            this.db,
            this.getFallbackSettingsKey(normalizedProvider),
            trimmedKey,
        );
        return {
            storageMode: "local_unencrypted",
            keychainAvailable: finalKeychainAvailable,
        };
    }

    async clearApiKey(provider: string): Promise<void> {
        const normalizedProvider = this.normalizeProvider(provider);
        const keychainAvailable = await this.isKeychainAvailable();

        if (keychainAvailable) {
            try {
                await secrets.delete({
                    service: this.serviceName,
                    name: this.getSecretName(normalizedProvider),
                });
                this.markKeychainAvailable();
            } catch {
                this.markKeychainUnavailable();
                logger.warn(
                    "failed to delete key from keychain, proceeding with DB clear",
                    {
                        provider: normalizedProvider,
                    },
                );
            }
        }
        setSetting(
            this.db,
            this.getFallbackSettingsKey(normalizedProvider),
            "",
        );
    }

    private async getApiKeyFromKeychain(
        provider: string,
    ): Promise<{ ok: boolean; value: string | null }> {
        try {
            const value = await secrets.get({
                service: this.serviceName,
                name: this.getSecretName(provider),
            });
            this.markKeychainAvailable();
            return {
                ok: true,
                value: value && value.trim().length > 0 ? value : null,
            };
        } catch {
            this.markKeychainUnavailable();
            return { ok: false, value: null };
        }
    }

    private getSecretName(provider: string): string {
        return `provider:${provider}:api-key`;
    }

    private getFallbackSettingsKey(provider: string): string {
        return `aiApiKey:${provider}`;
    }

    private normalizeProvider(provider: string): string {
        return provider.trim().toLowerCase();
    }
}
