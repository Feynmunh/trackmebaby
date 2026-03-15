export const SUPPORTED_AI_PROVIDERS = ["groq", "gemini"] as const;

export type SupportedAIProvider = (typeof SUPPORTED_AI_PROVIDERS)[number];

export function isSupportedAIProvider(
    provider: string,
): provider is SupportedAIProvider {
    return SUPPORTED_AI_PROVIDERS.includes(provider as SupportedAIProvider);
}

export function resolveAIProvider(provider: string): SupportedAIProvider {
    const normalized = provider.trim().toLowerCase();
    if (!isSupportedAIProvider(normalized)) {
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
    return normalized;
}
