/**
 * AI Provider Factory — creates the appropriate provider based on settings
 */

import {
    resolveAIProvider as resolveSupportedAIProvider,
    type SupportedAIProvider,
} from "../../../shared/ai-provider.ts";
import { GeminiProvider } from "./gemini-provider.ts";
import { GroqProvider } from "./groq-provider.ts";
import type { AIProvider } from "./provider.ts";

interface AIProviderConfig {
    provider: SupportedAIProvider;
    apiKey: string;
    model: string;
}

export function createAIProvider(config: AIProviderConfig): AIProvider {
    switch (config.provider) {
        case "groq":
            return new GroqProvider(config.apiKey, config.model);
        case "gemini":
            return new GeminiProvider(config.apiKey, config.model);
    }
}

export function resolveAIProvider(
    provider?: string | null,
): SupportedAIProvider {
    if (!provider) {
        throw new Error("AI provider is required");
    }
    return resolveSupportedAIProvider(provider);
}

export { getSavedApiKey } from "./config.ts";
export type { AIProvider } from "./provider.ts";
export { type AISecretStorageMode, AISecretStore } from "./secret-store.ts";
