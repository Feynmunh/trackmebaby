/**
 * AI Provider Factory — creates the appropriate provider based on settings
 */
import type { AIProvider } from "./provider.ts";
import { GroqProvider } from "./groq-provider.ts";

export interface AIProviderConfig {
    provider: string;
    apiKey: string;
    model: string;
}

/**
 * Create an AI provider based on the given configuration.
 * Currently supports: "groq" (default)
 */
export function createAIProvider(config: AIProviderConfig): AIProvider {
    switch (config.provider.toLowerCase()) {
        case "groq":
            return new GroqProvider(config.apiKey, config.model);
        case "openai":
            // OpenAI uses the same API shape but different URL
            // For now, use Groq provider with OpenAI compatibility
            return new GroqProvider(config.apiKey, config.model);
        default:
            console.warn(`[AI] Unknown provider "${config.provider}", falling back to Groq`);
            return new GroqProvider(config.apiKey, config.model);
    }
}

export type { AIProvider } from "./provider.ts";
