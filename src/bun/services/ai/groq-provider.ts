/**
 * Groq AI Provider — OpenAI-compatible API
 * Uses native fetch(), no SDK dependencies
 * Default model: llama-3.3-70b-versatile
 */
import type { AIProvider } from "./provider.ts";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You are trackmebaby, a developer activity tracking assistant. You help developers understand what they've been working on by analyzing their file changes, git activity, and project interactions.

When answering questions:
- Be concise and specific
- Focus on actionable information (what files changed, what branches, uncommitted work)
- Use natural language, not raw data
- If asked about time periods, summarize by project
- Highlight any uncommitted changes or stale branches
- If there's no relevant data, say so clearly

You receive context about the developer's recent activity, including file changes and git snapshots.`;

export class GroqProvider implements AIProvider {
    readonly name = "Groq";
    private apiKey: string;
    private model: string;

    constructor(apiKey: string, model: string = "llama-3.3-70b-versatile") {
        this.apiKey = apiKey;
        this.model = model;
    }

    async query(context: string, question: string): Promise<string> {
        if (!this.apiKey) {
            return "No API key configured. Please add your Groq API key in Settings.";
        }

        try {
            const response = await fetch(GROQ_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: "system", content: SYSTEM_PROMPT },
                        {
                            role: "user",
                            content: `Here is my recent developer activity:\n\n${context}\n\nQuestion: ${question}`,
                        },
                    ],
                    temperature: 0.3,
                    max_tokens: 1024,
                }),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                console.error(`[Groq] API error ${response.status}:`, errorBody);
                return `AI query failed (${response.status}). Please check your API key and try again.`;
            }

            const data = (await response.json()) as {
                choices: Array<{ message: { content: string } }>;
            };

            return data.choices?.[0]?.message?.content || "No response from AI.";
        } catch (err: any) {
            console.error("[Groq] Request error:", err.message);
            return `AI query failed: ${err.message}`;
        }
    }

    async testConnection(): Promise<boolean> {
        if (!this.apiKey) return false;

        try {
            const response = await fetch(GROQ_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [{ role: "user", content: "ping" }],
                    max_tokens: 5,
                }),
            });

            return response.ok;
        } catch {
            return false;
        }
    }
}
