import type { Database } from "bun:sqlite";
import type { SecretStorageMode, StoreSecretResult } from "../secret-store.ts";
import { SecretStore } from "../secret-store.ts";

export class AISecretStore {
    private secretStore: SecretStore;

    constructor(db: Database) {
        this.secretStore = new SecretStore(db, {
            serviceName: "com.trackmebaby.ai",
        });
    }

    async isKeychainAvailable(): Promise<boolean> {
        return await this.secretStore.isKeychainAvailable();
    }

    async getApiKey(provider: string): Promise<string> {
        const normalizedProvider = this.normalizeProvider(provider);
        return await this.secretStore.getSecret(
            this.getSecretName(normalizedProvider),
            this.getFallbackSettingsKey(normalizedProvider),
        );
    }

    async hasApiKey(provider: string): Promise<boolean> {
        const apiKey = await this.getApiKey(provider);
        return apiKey.trim().length > 0;
    }

    async getStorageMode(provider: string): Promise<SecretStorageMode> {
        const normalizedProvider = this.normalizeProvider(provider);
        return await this.secretStore.getStorageMode(
            this.getSecretName(normalizedProvider),
            this.getFallbackSettingsKey(normalizedProvider),
        );
    }

    async setApiKey(
        provider: string,
        apiKey: string,
    ): Promise<StoreSecretResult> {
        const normalizedProvider = this.normalizeProvider(provider);
        return await this.secretStore.setSecret(
            this.getSecretName(normalizedProvider),
            this.getFallbackSettingsKey(normalizedProvider),
            apiKey,
        );
    }

    async clearApiKey(provider: string): Promise<void> {
        const normalizedProvider = this.normalizeProvider(provider);
        await this.secretStore.clearSecret(
            this.getSecretName(normalizedProvider),
            this.getFallbackSettingsKey(normalizedProvider),
        );
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
