import type { Database } from "bun:sqlite";
import { secrets } from "bun";
import { createLogger } from "../../shared/logger.ts";
import { getSetting, setSetting } from "../db/queries.ts";

const logger = createLogger("secret-store");

export type SecretStorageMode = "secure" | "local_unencrypted" | "none";

export interface SecretStoreOptions {
    serviceName: string;
    probeTtlMs?: number;
}

export interface StoreSecretResult {
    storageMode: SecretStorageMode;
    keychainAvailable: boolean;
}

export class SecretStore {
    private db: Database;
    private readonly serviceName: string;
    private readonly probeTtlMs: number;
    private keychainAvailableCache: boolean | null = null;
    private lastProbeTime = 0;

    constructor(db: Database, options: SecretStoreOptions) {
        this.db = db;
        this.serviceName = options.serviceName;
        this.probeTtlMs = options.probeTtlMs ?? 30000;
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
            now - this.lastProbeTime < this.probeTtlMs
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

    async getSecret(
        secretName: string,
        fallbackSettingsKey: string,
    ): Promise<string> {
        const keychainAvailable = await this.isKeychainAvailable();
        if (!keychainAvailable) {
            return getSetting(this.db, fallbackSettingsKey) ?? "";
        }

        try {
            const value = await secrets.get({
                service: this.serviceName,
                name: secretName,
            });
            this.markKeychainAvailable();
            if (value && value.trim().length > 0) {
                return value;
            }
        } catch {
            this.markKeychainUnavailable();
        }

        return getSetting(this.db, fallbackSettingsKey) ?? "";
    }

    async getStorageMode(
        secretName: string,
        fallbackSettingsKey: string,
    ): Promise<SecretStorageMode> {
        const keychainAvailable = await this.isKeychainAvailable();
        if (!keychainAvailable) {
            const fallbackValue = getSetting(this.db, fallbackSettingsKey);
            if (fallbackValue && fallbackValue.trim().length > 0) {
                return "local_unencrypted";
            }
            return "none";
        }

        try {
            const value = await secrets.get({
                service: this.serviceName,
                name: secretName,
            });
            this.markKeychainAvailable();
            if (value && value.trim().length > 0) {
                return "secure";
            }
        } catch {
            this.markKeychainUnavailable();
        }

        const fallbackValue = getSetting(this.db, fallbackSettingsKey);
        if (fallbackValue && fallbackValue.trim().length > 0) {
            return "local_unencrypted";
        }
        return "none";
    }

    async setSecret(
        secretName: string,
        fallbackSettingsKey: string,
        rawValue: string,
    ): Promise<StoreSecretResult> {
        const value = rawValue.trim();
        if (!value) {
            await this.clearSecret(secretName, fallbackSettingsKey);
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
                    name: secretName,
                    value,
                });
                this.markKeychainAvailable();
                setSetting(this.db, fallbackSettingsKey, "");
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
                    secretName,
                });
            }
        }

        setSetting(this.db, fallbackSettingsKey, value);
        return {
            storageMode: "local_unencrypted",
            keychainAvailable: finalKeychainAvailable,
        };
    }

    async clearSecret(
        secretName: string,
        fallbackSettingsKey: string,
    ): Promise<void> {
        const keychainAvailable = await this.isKeychainAvailable();

        if (keychainAvailable) {
            try {
                await secrets.delete({
                    service: this.serviceName,
                    name: secretName,
                });
                this.markKeychainAvailable();
            } catch {
                this.markKeychainUnavailable();
                logger.warn(
                    "failed to delete key from keychain, proceeding with DB clear",
                    { secretName },
                );
            }
        }

        setSetting(this.db, fallbackSettingsKey, "");
    }

    async migrateFallbackToKeychain(
        secretName: string,
        fallbackSettingsKey: string,
    ): Promise<boolean> {
        const fallbackValue = getSetting(this.db, fallbackSettingsKey);
        if (!fallbackValue) {
            return false;
        }
        const trimmedFallbackValue = fallbackValue.trim();
        if (trimmedFallbackValue.length === 0) {
            return false;
        }

        const keychainAvailable = await this.isKeychainAvailable();
        if (!keychainAvailable) {
            return false;
        }

        try {
            await secrets.set({
                service: this.serviceName,
                name: secretName,
                value: trimmedFallbackValue,
            });
            this.markKeychainAvailable();

            const roundTrip = await secrets.get({
                service: this.serviceName,
                name: secretName,
            });
            this.markKeychainAvailable();

            if (roundTrip && roundTrip.trim() === trimmedFallbackValue) {
                setSetting(this.db, fallbackSettingsKey, "");
                return true;
            }

            logger.warn("keychain migration verification failed", {
                secretName,
            });
            return false;
        } catch (err: unknown) {
            this.markKeychainUnavailable();
            const message = err instanceof Error ? err.message : String(err);
            logger.warn("fallback-to-keychain migration failed", {
                secretName,
                error: message,
            });
            return false;
        }
    }
}
