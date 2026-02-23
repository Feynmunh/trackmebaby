import { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "../../shared/types.ts";

// Try to import RPC, fallback for dev/build
let queryAIFn: ((question: string) => Promise<string>) | null = null;
try {
    const rpc = await import("../rpc.ts");
    queryAIFn = rpc.queryAI;
} catch {
    // RPC not available (outside Electrobun)
}

const SUGGESTED_PROMPTS = [
    "What was I working on today?",
    "Summarize my work this week",
    "Which projects have uncommitted changes?",
    "What files did I change most recently?",
];

export default function AITab() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    async function sendMessage(question?: string) {
        const text = question || input.trim();
        if (!text || loading) return;

        const userMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "user",
            content: text,
            timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            let response: string;
            if (queryAIFn) {
                response = await queryAIFn(text);
            } else {
                // Mock response for development
                await new Promise((r) => setTimeout(r, 1000));
                response = "AI responses require the Electrobun runtime and a configured API key. Please run the app with `bun run dev`.";
            }

            const aiMsg: ChatMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: response,
                timestamp: new Date().toISOString(),
            };

            setMessages((prev) => [...prev, aiMsg]);
        } catch (err: any) {
            const errMsg: ChatMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: `Error: ${err.message}`,
                timestamp: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, errMsg]);
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 pt-6 pb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-white">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-xl font-bold text-white">AI Chat</h1>
                    <p className="text-sm text-gray-400">Ask about your work</p>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 space-y-4">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 flex items-center justify-center mb-6">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                strokeWidth={1.5} className="w-8 h-8 text-cyan-400">
                                <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                            </svg>
                        </div>
                        <h2 className="text-base font-semibold text-gray-300 mb-2">
                            Ask me anything
                        </h2>
                        <p className="text-sm text-gray-500 mb-6 max-w-xs">
                            I can help you remember what you were working on and summarize your activity.
                        </p>

                        {/* Suggested prompts */}
                        <div className="flex flex-wrap gap-2 justify-center max-w-md">
                            {SUGGESTED_PROMPTS.map((prompt) => (
                                <button
                                    key={prompt}
                                    onClick={() => sendMessage(prompt)}
                                    className="px-3 py-1.5 text-xs text-cyan-300 bg-cyan-500/5 border border-cyan-500/20 rounded-full hover:bg-cyan-500/10 hover:border-cyan-500/30 transition-all"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"
                                    }`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
                    ${msg.role === "user"
                                            ? "bg-violet-600 text-white rounded-br-md"
                                            : "bg-gray-800 text-gray-200 border border-gray-700/50 rounded-bl-md"
                                        }
                  `}
                                >
                                    <pre className="whitespace-pre-wrap font-sans m-0">{msg.content}</pre>
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-gray-800 border border-gray-700/50 rounded-2xl rounded-bl-md px-4 py-3">
                                    <div className="flex gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                                        <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                                        <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Input area */}
            <div className="px-6 py-4">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        sendMessage();
                    }}
                    className="flex gap-2"
                >
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about your work..."
                        disabled={loading}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={loading || !input.trim()}
                        className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-xl transition-colors text-sm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
                        </svg>
                    </button>
                </form>
            </div>
        </div>
    );
}
