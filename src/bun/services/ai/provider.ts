/**
 * AI Provider Interface — provider-agnostic abstraction
 * All AI implementations must conform to this interface
 */

export interface AIProvider {
    /**
     * Send a query with context to the AI model.
     * @param context - Readable activity summary (pre-formatted)
     * @param question - User's natural language question
     * @returns AI's response text
     */
    query(context: string, question: string): Promise<string>;

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
