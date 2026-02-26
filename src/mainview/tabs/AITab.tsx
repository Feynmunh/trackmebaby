import { ArrowUp, Mic, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toErrorData, toErrorMessage } from "../../shared/error.ts";
import { createLogger } from "../../shared/logger.ts";
import { nowIso } from "../../shared/time.ts";
import type { ChatMessage } from "../../shared/types.ts";

const logger = createLogger("ai-tab");

// Try to import RPC, fallback for dev/build
let queryAIFn: ((question: string) => Promise<string>) | null = null;
try {
    const rpc = await import("../rpc.ts");
    queryAIFn = rpc.queryAI;
} catch (err: unknown) {
    logger.warn("rpc not available", { error: toErrorData(err) });
}

export default function AITab() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("Explain me about this image");
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    async function sendMessage(question?: string) {
        const text = question || input.trim();
        if (!text || loading) return;

        const userMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "user",
            content: text,
            timestamp: nowIso(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            let response: string;
            if (queryAIFn) {
                response = await queryAIFn(text);
            } else {
                await new Promise((r) => setTimeout(r, 1000));
                response =
                    "AI responses require the Electrobun runtime and a configured API key.";
            }

            const aiMsg: ChatMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: response,
                timestamp: nowIso(),
            };

            setMessages((prev) => [...prev, aiMsg]);
        } catch (err: unknown) {
            const message = toErrorMessage(err);
            const errMsg: ChatMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: `Error: ${message}`,
                timestamp: nowIso(),
            };
            setMessages((prev) => [...prev, errMsg]);
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    }

    const hasMessages = messages.length > 0;

    return (
        <div className="h-full flex flex-col relative overflow-hidden bg-white dark:bg-black transition-colors duration-500 font-sans">
            {/* --- Content Area --- */}
            <div className="relative z-10 flex-1 flex flex-col items-center pt-24">
                {/* Landing Headlines */}
                <div
                    className={`text-center px-6 transition-all duration-700 ${hasMessages ? "opacity-0 -translate-y-8 absolute pointer-events-none" : "opacity-100 translate-y-0"}`}
                >
                    <h1 className="text-4xl md:text-6xl text-black dark:text-white leading-tight font-playfair tracking-normal">
                        How can I{" "}
                        <span className="italic font-playfair">help</span> you?
                    </h1>
                    <p className="mt-6 text-[15px] text-black/60 dark:text-white/60 max-w-xl mx-auto leading-relaxed">
                        Meet the AI chatbot that understands, learns, and
                        delivers your personal assistant for everything from
                        customer support to creative ideas.
                    </p>
                </div>

                {/* Main Chat Interface Container */}
                <div
                    className={`w-full max-w-4xl mx-auto flex-1 flex flex-col transition-all duration-700 ${hasMessages ? "mt-0 rounded-none border-none bg-transparent shadow-none" : "mt-16 bg-white/40 dark:bg-black/40 backdrop-blur-2xl border-t border-x border-black/5 dark:border-white/10 rounded-t-[2.5rem] shadow-2xl relative px-6 py-6"}`}
                >
                    {/* Chat Messages Area (only visible when hasMessages) */}
                    {hasMessages && (
                        <div className="flex-1 overflow-y-auto px-6 py-8">
                            <div className="space-y-6 max-w-3xl mx-auto w-full pb-32">
                                {messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                    >
                                        <div
                                            className={`max-w-[80%] rounded-3xl px-6 py-4 text-[15px] leading-relaxed
                                                ${
                                                    msg.role === "user"
                                                        ? "bg-[#EF530B] text-white rounded-br-md shadow-[0_4px_20px_rgba(239,83,11,0.2)]"
                                                        : "bg-white dark:bg-[#0A0A0A] text-black/90 dark:text-white/90 rounded-bl-md shadow-sm border border-black/5 dark:border-white/10"
                                                }
                                            `}
                                        >
                                            <pre className="whitespace-pre-wrap font-sans m-0 break-words">
                                                {msg.content}
                                            </pre>
                                        </div>
                                    </div>
                                ))}
                                {loading && (
                                    <div className="flex justify-start">
                                        <div className="bg-white dark:bg-[#0A0A0A] rounded-3xl rounded-bl-md px-6 py-5 shadow-sm border border-black/5 dark:border-white/10">
                                            <div className="flex gap-2">
                                                <div
                                                    className="w-2 h-2 rounded-full bg-black/40 dark:bg-white/40 animate-bounce"
                                                    style={{
                                                        animationDelay: "0ms",
                                                    }}
                                                />
                                                <div
                                                    className="w-2 h-2 rounded-full bg-black/40 dark:bg-white/40 animate-bounce"
                                                    style={{
                                                        animationDelay: "150ms",
                                                    }}
                                                />
                                                <div
                                                    className="w-2 h-2 rounded-full bg-black/40 dark:bg-white/40 animate-bounce"
                                                    style={{
                                                        animationDelay: "300ms",
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>
                    )}

                    {/* The elaborate input box matching the image */}
                    <div
                        className={`${hasMessages ? "absolute bottom-6 left-0 right-0 px-6" : "w-full"} z-20 transition-all duration-700`}
                    >
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                sendMessage();
                            }}
                            className="max-w-3xl mx-auto mb-8 relative"
                        >
                            <div className="bg-white dark:bg-black rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] border border-black/5 dark:border-white/10 p-4">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Ask anything..."
                                    disabled={loading}
                                    className="w-full bg-transparent border-none outline-none text-black dark:text-white placeholder-black/40 dark:placeholder-white/40 font-medium text-[15px] mb-3 px-1"
                                />

                                {/* Action Bar */}
                                <div className="flex items-center justify-between pt-1">
                                    <div className="flex items-center gap-4 text-black/40 dark:text-white/40">
                                        <button
                                            type="button"
                                            className="hover:text-black/70 dark:hover:text-white/70 transition-colors p-1"
                                        >
                                            <Plus className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            className="text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70 transition-colors"
                                        >
                                            <Mic className="w-5 h-5" />
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading || !input.trim()}
                                            className="w-8 h-8 rounded-full bg-[#EF530B] hover:bg-[#D94808] disabled:bg-black/10 dark:disabled:bg-white/10 flex items-center justify-center text-white transition-colors shadow-md shadow-[#EF530B]/20"
                                        >
                                            <ArrowUp
                                                className="w-4 h-4"
                                                strokeWidth={3}
                                            />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
