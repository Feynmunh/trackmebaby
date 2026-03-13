/**
 * AI Configuration helpers
 */

export function getSavedApiKey(provider?: string): string {
    const normalized = provider?.toLowerCase();

    if (normalized === "gemini") {
        return process.env.GEMINI_API_KEY || process.env.AI_API_KEY || "";
    }

    if (normalized === "groq" || normalized === "openai") {
        return process.env.GROQ_API_KEY || process.env.AI_API_KEY || "";
    }

    return (
        process.env.GROQ_API_KEY ||
        process.env.GEMINI_API_KEY ||
        process.env.AI_API_KEY ||
        ""
    );
}
