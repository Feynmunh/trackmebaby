import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useToast } from "./Toast.tsx";
import Tooltip from "./Tooltip.tsx";

interface MarkdownProps {
    content: string;
    className?: string;
    textSize?: string;
}

export default function Markdown({
    content,
    className = "",
    textSize = "text-[15px]",
}: MarkdownProps) {
    const { showToast } = useToast();

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            showToast("Copied to clipboard", "success");
        });
    };

    return (
        <div
            className={`${textSize} leading-relaxed text-app-text-main/90 font-medium ${className}`}
        >
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    p: ({ children }) => (
                        <p className="my-2 first:mt-0 last:mb-0">{children}</p>
                    ),
                    strong: ({ children }) => (
                        <strong className="font-semibold text-app-text-main underline decoration-app-accent/30 decoration-2 underline-offset-2">
                            {children}
                        </strong>
                    ),
                    em: ({ children }) => (
                        <em className="italic opacity-90">{children}</em>
                    ),
                    a: ({ children, href }) => (
                        <a
                            href={href}
                            className="underline decoration-2 underline-offset-2 text-app-accent hover:opacity-80 transition-colors"
                            target="_blank"
                            rel="noreferrer"
                        >
                            {children}
                        </a>
                    ),
                    ul: ({ children }) => (
                        <ul className="list-disc pl-5 space-y-1 my-2">
                            {children}
                        </ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="list-decimal pl-5 space-y-1 my-2">
                            {children}
                        </ol>
                    ),
                    li: ({ children }) => (
                        <li className="leading-relaxed">{children}</li>
                    ),
                    code: ({ className, children }) => {
                        const isBlock =
                            typeof className === "string" &&
                            className.includes("language-");

                        const codeContent = String(children).replace(/\n$/, "");

                        if (isBlock) {
                            return (
                                <div className="relative group/code-block">
                                    <code className="block w-full overflow-auto rounded-lg bg-app-surface-elevated p-3 font-mono text-[13px] border border-app-border my-2">
                                        {children}
                                    </code>
                                    <button
                                        onClick={() =>
                                            copyToClipboard(codeContent)
                                        }
                                        className="absolute top-4 right-4 opacity-0 group-hover/code-block:opacity-100 transition-opacity bg-app-surface border border-app-border rounded px-2 py-1 text-[9px] font-bold text-app-text-muted hover:text-app-text-main"
                                    >
                                        Copy
                                    </button>
                                </div>
                            );
                        }

                        return (
                            <Tooltip content="Click to copy">
                                <code
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        copyToClipboard(codeContent);
                                    }}
                                    className="px-1.5 py-0.5 rounded-md bg-app-surface-elevated text-app-text-main font-mono text-[13px] border border-app-border/50 cursor-pointer hover:border-app-accent/50 transition-colors active:scale-95"
                                >
                                    {children}
                                </code>
                            </Tooltip>
                        );
                    },
                    pre: ({ children }) => (
                        <div className="my-3 w-full">{children}</div>
                    ),
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-app-border pl-3 ml-1 text-app-text-muted italic">
                            {children}
                        </blockquote>
                    ),
                    hr: () => <hr className="my-4 border-app-border" />,
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
