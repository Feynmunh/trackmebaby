import type { SupportedAIProvider } from "./ai-provider.ts";

export const AI_MODELS_BY_PROVIDER: Record<
    SupportedAIProvider,
    readonly string[]
> = {
    groq: [
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
    ],
    gemini: [
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-3.1-pro-preview",
        "gemini-3.1-flash-lite-preview",
        "gemini-3-flash-preview",
    ],
};

export const DEFAULT_AI_MODEL_BY_PROVIDER: Record<SupportedAIProvider, string> =
    {
        groq: AI_MODELS_BY_PROVIDER.groq[0],
        gemini: AI_MODELS_BY_PROVIDER.gemini[0],
    };

export function normalizeAIModel(
    provider: SupportedAIProvider,
    model?: string | null,
): string {
    const normalized = model?.trim() ?? "";
    if (AI_MODELS_BY_PROVIDER[provider].includes(normalized)) {
        return normalized;
    }
    return DEFAULT_AI_MODEL_BY_PROVIDER[provider];
}
