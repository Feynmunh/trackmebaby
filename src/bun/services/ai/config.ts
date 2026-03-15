/**
 * AI Configuration helpers
 */

import type { AISecretStore } from "./secret-store.ts";

export async function getSavedApiKey(
    secretStore: AISecretStore,
    provider?: string,
): Promise<string> {
    const normalized = provider?.toLowerCase();

    if (normalized === "gemini") {
        return (await secretStore.getApiKey("gemini")) || "";
    }

    if (normalized === "groq" || normalized === "openai") {
        return (await secretStore.getApiKey(normalized)) || "";
    }

    const groqKey = await secretStore.getApiKey("groq");
    const geminiKey = await secretStore.getApiKey("gemini");

    return groqKey || geminiKey || "";
}
