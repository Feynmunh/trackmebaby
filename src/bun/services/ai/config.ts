/**
 * AI Configuration helpers
 */

export function getSavedApiKey(): string {
    return process.env.GROQ_API_KEY || process.env.AI_API_KEY || "";
}
