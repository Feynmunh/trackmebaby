/**
 * AI Provider Interface — provider-agnostic abstraction
 * All AI implementations must conform to this interface
 */

export interface AIQueryOptions {
    maxTokens?: number;
    jsonMode?: boolean;
}

export interface AIProvider {
    query(
        context: string,
        question: string,
        systemPrompt?: string,
        options?: AIQueryOptions,
    ): Promise<string>;

    /**
     * Test if the provider connection is working.
     * @returns true if connection is valid
     */
    testConnection(): Promise<boolean>;

    /**
     * Get the provider name (for display).
     */
    readonly name: string;
}
