/**
 * AI Provider Factory — creates the appropriate provider based on settings
 */

import { createLogger } from "../../../shared/logger.ts";
import { GeminiProvider } from "./gemini-provider.ts";
import { GroqProvider } from "./groq-provider.ts";
import type { AIProvider } from "./provider.ts";

interface AIProviderConfig {
    provider: string;
    apiKey: string;
    model: string;
}

const logger = createLogger("ai");

export function createAIProvider(config: AIProviderConfig): AIProvider {
    switch (config.provider.toLowerCase()) {
        case "groq":
        case "openai":
            return new GroqProvider(config.apiKey, config.model);
        case "gemini":
            return new GeminiProvider(config.apiKey, config.model);
        default:
            logger.warn("unknown ai provider, falling back", {
                provider: config.provider,
            });
            return new GroqProvider(config.apiKey, config.model);
    }
}

export { getSavedApiKey } from "./config.ts";
export type { AIProvider } from "./provider.ts";
export { type AISecretStorageMode, AISecretStore } from "./secret-store.ts";
