/**
 * AI Configuration helpers
 */

import type { SupportedAIProvider } from "../../../shared/ai-provider.ts";
import type { AISecretStore } from "./secret-store.ts";

export async function getSavedApiKey(
    secretStore: AISecretStore,
    provider?: SupportedAIProvider,
): Promise<string> {
    if (!provider) {
        return "";
    }

    if (provider === "gemini") {
        return (await secretStore.getApiKey("gemini")) || "";
    }

    return (await secretStore.getApiKey("groq")) || "";
}
