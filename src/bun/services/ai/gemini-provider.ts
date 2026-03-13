/**
 * Gemini AI Provider — Google Gemini API via @google/genai SDK
 * Default model: gemini-2.5-flash
 */

import { GoogleGenAI } from "@google/genai";
import { toErrorData, toErrorMessage } from "../../../shared/error.ts";
import { createLogger } from "../../../shared/logger.ts";
import type { AIProvider, AIQueryOptions, ChatTurn } from "./provider.ts";

const DEFAULT_SYSTEM_PROMPT = `You are trackmebaby, a developer activity tracking assistant. You help developers understand what they've been working on by analyzing their file changes, git activity, and project interactions.

When answering questions:
- Be concise and specific
- Focus on actionable information (what files changed, what branches, uncommitted work)
- Use natural language, not raw data
- If asked about time periods, summarize by project
- Highlight any uncommitted changes or stale branches
- If there's no relevant data, say so clearly

You receive context about the developer's recent activity, including file changes and git snapshots.`;

const logger = createLogger("gemini");

export class GeminiProvider implements AIProvider {
    readonly name = "Gemini";
    private client: GoogleGenAI;
    private model: string;
    private apiKey: string;

    constructor(apiKey: string, model: string = "gemini-2.5-flash") {
        this.apiKey = apiKey;
        this.model = model;
        this.client = new GoogleGenAI({ apiKey });
    }

    async query(
        context: string,
        question: string,
        systemPrompt?: string,
        options?: AIQueryOptions,
    ): Promise<string> {
        if (!this.apiKey) {
            return "Please add your GEMINI_API_KEY to your environment to get AI insights.";
        }

        try {
            const prompt = `Here is my recent developer activity:\n\n${context}\n\nQuestion: ${question}`;

            const response = await this.client.models.generateContent({
                model: this.model,
                contents: prompt,
                config: {
                    systemInstruction: systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
                    temperature: 0.3,
                    maxOutputTokens: options?.maxTokens ?? 1024,
                    ...(options?.jsonMode
                        ? { responseMimeType: "application/json" }
                        : {}),
                },
            });

            return response.text ?? "No response from AI.";
        } catch (err: unknown) {
            const message = toErrorMessage(err);
            logger.error("request error", { error: toErrorData(err) });

            if (
                message.includes("API key") ||
                message.includes("403") ||
                message.includes("401")
            ) {
                return "Invalid API key. Please check your GEMINI_API_KEY.";
            }
            if (
                message.includes("429") ||
                message.toLowerCase().includes("quota")
            ) {
                return "Rate limit reached. Please wait a moment and try again.";
            }
            return `AI query failed: ${message}`;
        }
    }

    async testConnection(): Promise<boolean> {
        if (!this.apiKey) return false;

        try {
            const response = await this.client.models.generateContent({
                model: this.model,
                contents: "ping",
                config: { maxOutputTokens: 5 },
            });

            return !!response.text;
        } catch (err: unknown) {
            logger.warn("health check failed", { error: toErrorData(err) });
            return false;
        }
    }

    async queryMultiTurn(
        systemPrompt: string,
        messages: ChatTurn[],
        options?: AIQueryOptions,
    ): Promise<string> {
        if (!this.apiKey) {
            return "Please add your GEMINI_API_KEY to your environment to get AI insights.";
        }

        try {
            const contents = messages.map((m) => ({
                role: m.role as "user" | "model",
                parts: [{ text: m.content }],
            }));

            const response = await this.client.models.generateContent({
                model: this.model,
                contents,
                config: {
                    systemInstruction: systemPrompt,
                    temperature: 0.3,
                    maxOutputTokens: options?.maxTokens ?? 2048,
                    ...(options?.jsonMode
                        ? { responseMimeType: "application/json" }
                        : {}),
                },
            });

            return response.text ?? "No response from AI.";
        } catch (err: unknown) {
            const message = toErrorMessage(err);
            logger.error("multi-turn request error", {
                error: toErrorData(err),
            });

            if (
                message.includes("API key") ||
                message.includes("403") ||
                message.includes("401")
            ) {
                return "Invalid API key. Please check your GEMINI_API_KEY.";
            }
            if (
                message.includes("429") ||
                message.toLowerCase().includes("quota")
            ) {
                return "Rate limit reached. Please wait a moment and try again.";
            }
            return `AI query failed: ${message}`;
        }
    }
}
