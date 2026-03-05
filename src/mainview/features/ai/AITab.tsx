import {
    ArrowUp,
    Hash,
    MessageSquarePlus,
    MoreHorizontal,
    Pencil,
    Search,
    Sparkles,
    Trash2,
    X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toErrorData, toErrorMessage } from "../../../shared/error.ts";
import { createLogger } from "../../../shared/logger.ts";
import type {
    ChatMessageRecord,
    Conversation,
    Project,
    ScreenContext,
} from "../../../shared/types.ts";

const logger = createLogger("ai-tab");

// ─── RPC imports (graceful fallback for dev) ─────────────────────────────────

interface RPCFunctions {
    createConversation: (title?: string) => Promise<Conversation>;
    getConversations: () => Promise<Conversation[]>;
    getConversationMessages: (
        conversationId: string,
    ) => Promise<ChatMessageRecord[]>;
    deleteConversation: (
        conversationId: string,
    ) => Promise<{ success: boolean }>;
    renameConversation: (
        conversationId: string,
        title: string,
    ) => Promise<{ success: boolean }>;
    sendChatMessage: (params: {
        conversationId: string;
        content: string;
        taggedProjectIds?: string[];
        screenContext?: ScreenContext;
    }) => Promise<{
        userMessage: ChatMessageRecord;
        assistantMessage: ChatMessageRecord;
    }>;
    getProjects: () => Promise<Project[]>;
}

let rpcFns: RPCFunctions | null = null;

try {
    const rpc = await import("../../rpc.ts");
    rpcFns = {
        createConversation: rpc.createConversation,
        getConversations: rpc.getConversations,
        getConversationMessages: rpc.getConversationMessages,
        deleteConversation: rpc.deleteConversation,
        renameConversation: rpc.renameConversation,
        sendChatMessage: rpc.sendChatMessage,
        getProjects: rpc.getProjects,
    };
} catch (err: unknown) {
    logger.warn("rpc not available", { error: toErrorData(err) });
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface AITabProps {
    screenContext?: {
        activeTab: string;
        selectedProjectId: string | null;
        selectedProjectName: string | null;
    };
    /** When true, renders in compact sidebar mode: conversation list hidden by default */
    isSidebar?: boolean;
}

// ─── Markdown-lite renderer ──────────────────────────────────────────────────

function renderMarkdown(text: string): JSX.Element[] {
    const lines = text.split("\n");
    const elements: JSX.Element[] = [];
    let inCodeBlock = false;
    let codeBlockLang = "";
    let codeLines: string[] = [];
    let blockIndex = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith("```")) {
            if (inCodeBlock) {
                elements.push(
                    <div
                        key={`code-${blockIndex++}`}
                        className="my-3 rounded-lg overflow-hidden border border-app-border"
                    >
                        {codeBlockLang && (
                            <div className="px-3 py-1.5 bg-app-surface text-[11px] text-app-text-muted font-mono border-b border-app-border">
                                {codeBlockLang}
                            </div>
                        )}
                        <pre className="p-3 bg-app-surface-elevated text-[13px] leading-relaxed overflow-x-auto font-mono">
                            <code>{codeLines.join("\n")}</code>
                        </pre>
                    </div>,
                );
                inCodeBlock = false;
                codeLines = [];
                codeBlockLang = "";
            } else {
                inCodeBlock = true;
                codeBlockLang = line.slice(3).trim();
            }
            continue;
        }

        if (inCodeBlock) {
            codeLines.push(line);
            continue;
        }

        if (line.trim() === "") {
            elements.push(<div key={`br-${i}`} className="h-2" />);
            continue;
        }

        elements.push(
            <p
                key={`p-${i}`}
                className="leading-relaxed"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: markdown rendering with pre-sanitized input
                dangerouslySetInnerHTML={{
                    // Escape raw HTML first so AI-injected tags can't execute,
                    // then apply safe inline-markdown replacements.
                    __html: line
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/"/g, "&quot;")
                        .replace(
                            /\*\*(.+?)\*\*/g,
                            '<strong class="font-semibold">$1</strong>',
                        )
                        .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
                        .replace(
                            /`([^`]+)`/g,
                            '<code class="px-1.5 py-0.5 rounded bg-app-surface-elevated text-[13px] font-mono text-app-accent">$1</code>',
                        ),
                }}
            />,
        );
    }

    // Close unclosed code block
    if (inCodeBlock && codeLines.length > 0) {
        elements.push(
            <div
                key={`code-${blockIndex}`}
                className="my-3 rounded-lg overflow-hidden border border-app-border"
            >
                <pre className="p-3 bg-app-surface-elevated text-[13px] leading-relaxed overflow-x-auto font-mono">
                    <code>{codeLines.join("\n")}</code>
                </pre>
            </div>,
        );
    }

    return elements;
}

// ─── @ Mention Popup ─────────────────────────────────────────────────────────

function MentionPopup({
    projects,
    filter,
    onSelect,
    onClose,
    position,
}: {
    projects: Project[];
    filter: string;
    onSelect: (project: Project) => void;
    onClose: () => void;
    position: { top: number; left: number };
}) {
    const filtered = useMemo(() => {
        const q = filter.toLowerCase();
        return projects.filter(
            (p) =>
                p.name.toLowerCase().includes(q) ||
                p.path.toLowerCase().includes(q),
        );
    }, [projects, filter]);

    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
        setSelectedIndex(0);
    }, [filter]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && filtered[selectedIndex]) {
                e.preventDefault();
                onSelect(filtered[selectedIndex]);
            } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [filtered, selectedIndex, onSelect, onClose]);

    if (filtered.length === 0) {
        return (
            <div
                className="absolute z-50 w-72 bg-app-surface border border-app-border rounded-xl shadow-app-lg p-3"
                style={{ bottom: position.top, left: position.left }}
            >
                <p className="text-sm text-app-text-muted text-center py-2">
                    No projects found
                </p>
            </div>
        );
    }

    return (
        <div
            className="absolute z-50 w-80 max-h-64 overflow-y-auto bg-app-surface border border-app-border rounded-xl shadow-app-lg py-1.5"
            style={{ bottom: position.top, left: position.left }}
        >
            <div className="px-3 py-1.5 text-[11px] font-medium text-app-text-muted uppercase tracking-wider">
                Tag a project
            </div>
            {filtered.slice(0, 8).map((project, idx) => (
                <button
                    key={project.id}
                    type="button"
                    className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors ${
                        idx === selectedIndex
                            ? "bg-app-accent/10 text-app-accent"
                            : "hover:bg-app-hover text-app-text-main"
                    }`}
                    onClick={() => onSelect(project)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                >
                    <Hash className="w-3.5 h-3.5 shrink-0 opacity-50" />
                    <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                            {project.name}
                        </div>
                        <div className="text-[11px] text-app-text-muted truncate">
                            {project.path}
                        </div>
                    </div>
                </button>
            ))}
        </div>
    );
}

// ─── Conversation Sidebar Item ───────────────────────────────────────────────

function ConversationItem({
    conversation,
    isActive,
    onClick,
    onDelete,
    onRename,
}: {
    conversation: Conversation;
    isActive: boolean;
    onClick: () => void;
    onDelete: () => void;
    onRename: (title: string) => void;
}) {
    const [showMenu, setShowMenu] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState(conversation.title);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isRenaming) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isRenaming]);

    return (
        <div
            className={`group relative flex items-center gap-2 px-1 py-0.5 rounded-lg transition-colors ${
                isActive
                    ? "bg-app-accent/10 text-app-accent"
                    : "hover:bg-app-hover text-app-text-main"
            }`}
        >
            <button
                type="button"
                className="flex-1 flex items-center gap-2 px-2 py-1.5 min-w-0 text-left cursor-pointer rounded-md"
                onClick={onClick}
            >
                <MessageSquarePlus className="w-3.5 h-3.5 shrink-0 opacity-60" />
                {isRenaming ? (
                    <input
                        ref={inputRef}
                        className="flex-1 min-w-0 text-sm bg-transparent border-b border-app-accent outline-none px-0 py-0"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => {
                            setIsRenaming(false);
                            if (
                                renameValue.trim() &&
                                renameValue !== conversation.title
                            ) {
                                onRename(renameValue.trim());
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                setIsRenaming(false);
                                if (
                                    renameValue.trim() &&
                                    renameValue !== conversation.title
                                ) {
                                    onRename(renameValue.trim());
                                }
                            } else if (e.key === "Escape") {
                                setIsRenaming(false);
                                setRenameValue(conversation.title);
                            }
                        }}
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span className="flex-1 min-w-0 text-sm truncate">
                        {conversation.title}
                    </span>
                )}
            </button>
            <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    type="button"
                    className="p-0.5 hover:bg-app-surface-elevated rounded"
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(!showMenu);
                    }}
                >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
            </div>
            {showMenu && (
                <div className="absolute right-0 top-full mt-1 z-50 w-36 bg-app-surface border border-app-border rounded-lg shadow-app-lg py-1">
                    <button
                        type="button"
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-app-hover flex items-center gap-2 text-app-text-main"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(false);
                            setIsRenaming(true);
                        }}
                    >
                        <Pencil className="w-3.5 h-3.5" /> Rename
                    </button>
                    <button
                        type="button"
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-app-hover flex items-center gap-2 text-app-error"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(false);
                            onDelete();
                        }}
                    >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Main AI Tab ─────────────────────────────────────────────────────────────

export default function AITab({
    screenContext,
    isSidebar = false,
}: AITabProps) {
    // Conversations state
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<
        string | null
    >(null);
    const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [input, setInput] = useState("");
    const [sidebarOpen, setSidebarOpen] = useState(!isSidebar);
    const [sidebarSearch, setSidebarSearch] = useState("");

    // @ mention state
    const [projects, setProjects] = useState<Project[]>([]);
    const [taggedProjects, setTaggedProjects] = useState<Project[]>([]);
    const [showMentionPopup, setShowMentionPopup] = useState(false);
    const [mentionFilter, setMentionFilter] = useState("");
    const [mentionCursorPos, setMentionCursorPos] = useState(0);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Define callbacks BEFORE the useEffect that calls them to avoid TDZ
    const loadConversations = useCallback(async () => {
        if (!rpcFns) return;
        try {
            const convos = await rpcFns.getConversations();
            setConversations(convos);
        } catch (err: unknown) {
            logger.error("failed to load conversations", {
                error: toErrorData(err),
            });
        }
    }, []);

    const loadProjects = useCallback(async () => {
        if (!rpcFns) return;
        try {
            const p = await rpcFns.getProjects();
            setProjects(p);
        } catch (err: unknown) {
            logger.error("failed to load projects", {
                error: toErrorData(err),
            });
        }
    }, []);

    // Load initial data — callbacks are defined above so no TDZ risk
    useEffect(() => {
        loadConversations();
        loadProjects();
    }, [loadConversations, loadProjects]);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    // Auto-resize textarea
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = "auto";
            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 160)}px`;
        }
    }, [input]);

    const loadMessages = useCallback(async (conversationId: string) => {
        if (!rpcFns) return;
        try {
            const msgs = await rpcFns.getConversationMessages(conversationId);
            setMessages(msgs);
        } catch (err: unknown) {
            logger.error("failed to load messages", {
                error: toErrorData(err),
            });
        }
    }, []);

    const selectConversation = useCallback(
        async (conversationId: string) => {
            setActiveConversationId(conversationId);
            await loadMessages(conversationId);
        },
        [loadMessages],
    );

    const createNewChat = useCallback(async () => {
        if (!rpcFns) return;
        try {
            const convo = await rpcFns.createConversation();
            setConversations((prev) => [convo, ...prev]);
            setActiveConversationId(convo.id);
            setMessages([]);
            setTaggedProjects([]);
            setInput("");
            inputRef.current?.focus();
        } catch (err: unknown) {
            logger.error("failed to create conversation", {
                error: toErrorData(err),
            });
        }
    }, []);

    const handleDeleteConversation = useCallback(
        async (conversationId: string) => {
            if (!rpcFns) return;
            try {
                await rpcFns.deleteConversation(conversationId);
                setConversations((prev) =>
                    prev.filter((c) => c.id !== conversationId),
                );
                if (activeConversationId === conversationId) {
                    setActiveConversationId(null);
                    setMessages([]);
                }
            } catch (err: unknown) {
                logger.error("failed to delete conversation", {
                    error: toErrorData(err),
                });
            }
        },
        [activeConversationId],
    );

    const handleRenameConversation = useCallback(
        async (conversationId: string, title: string) => {
            if (!rpcFns) return;
            try {
                await rpcFns.renameConversation(conversationId, title);
                setConversations((prev) =>
                    prev.map((c) =>
                        c.id === conversationId ? { ...c, title } : c,
                    ),
                );
            } catch (err: unknown) {
                logger.error("failed to rename conversation", {
                    error: toErrorData(err),
                });
            }
        },
        [],
    );

    const sendMessage = useCallback(async () => {
        const text = input.trim();
        if (!text || loading || !rpcFns) return;

        let conversationId = activeConversationId;

        // Auto-create conversation if none active
        if (!conversationId) {
            try {
                const convo = await rpcFns.createConversation();
                setConversations((prev) => [convo, ...prev]);
                conversationId = convo.id;
                setActiveConversationId(convo.id);
            } catch (err: unknown) {
                logger.error("failed to auto-create conversation", {
                    error: toErrorData(err),
                });
                return;
            }
        }

        setInput("");
        setTaggedProjects([]);
        setLoading(true);

        // Optimistic user message
        const optimisticUserMsg: ChatMessageRecord = {
            id: crypto.randomUUID(),
            conversationId,
            role: "user",
            content: text,
            taggedProjectIds: taggedProjects.map((p) => p.id),
            screenContext: screenContext
                ? { ...screenContext, visibleData: null }
                : null,
            timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimisticUserMsg]);

        try {
            const sc: ScreenContext | undefined = screenContext
                ? { ...screenContext, visibleData: null }
                : undefined;

            const result = await rpcFns.sendChatMessage({
                conversationId,
                content: text,
                taggedProjectIds: taggedProjects.map((p) => p.id),
                screenContext: sc,
            });

            // Replace optimistic msg + add assistant response
            setMessages((prev) => {
                const filtered = prev.filter(
                    (m) => m.id !== optimisticUserMsg.id,
                );
                return [
                    ...filtered,
                    result.userMessage,
                    result.assistantMessage,
                ];
            });

            // Refresh conversations to get updated title
            await loadConversations();
        } catch (err: unknown) {
            const message = toErrorMessage(err);
            setMessages((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    conversationId,
                    role: "assistant",
                    content: `Error: ${message}`,
                    taggedProjectIds: [],
                    screenContext: null,
                    timestamp: new Date().toISOString(),
                },
            ]);
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    }, [
        input,
        loading,
        activeConversationId,
        taggedProjects,
        screenContext,
        loadConversations,
    ]);

    // Handle input changes for @ mentions
    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            const value = e.target.value;
            const cursorPos = e.target.selectionStart ?? 0;
            setInput(value);

            // Check for @ trigger
            const textBeforeCursor = value.slice(0, cursorPos);
            // Use [^\s@]* so project names containing hyphens/dots match fully
            const atMatch = textBeforeCursor.match(/@([^\s@]*)$/);

            if (atMatch) {
                setShowMentionPopup(true);
                setMentionFilter(atMatch[1]);
                setMentionCursorPos(atMatch.index ?? 0);
            } else {
                setShowMentionPopup(false);
                setMentionFilter("");
            }
        },
        [],
    );

    const handleMentionSelect = useCallback(
        (project: Project) => {
            // Replace @filter with @ProjectName
            const beforeAt = input.slice(0, mentionCursorPos);
            const afterMention = input.slice(
                mentionCursorPos + mentionFilter.length + 1,
            );
            const newInput = `${beforeAt}@${project.name} ${afterMention}`;
            setInput(newInput);
            setShowMentionPopup(false);
            setMentionFilter("");

            // Add to tagged projects
            if (!taggedProjects.find((p) => p.id === project.id)) {
                setTaggedProjects((prev) => [...prev, project]);
            }

            inputRef.current?.focus();
        },
        [input, mentionCursorPos, mentionFilter, taggedProjects],
    );

    const removeTaggedProject = useCallback((projectId: string) => {
        setTaggedProjects((prev) => prev.filter((p) => p.id !== projectId));
    }, []);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (showMentionPopup) return; // Let popup handle navigation
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        },
        [showMentionPopup, sendMessage],
    );

    const filteredConversations = useMemo(() => {
        if (!sidebarSearch.trim()) return conversations;
        const q = sidebarSearch.toLowerCase();
        return conversations.filter((c) => c.title.toLowerCase().includes(q));
    }, [conversations, sidebarSearch]);

    const activeConversation = conversations.find(
        (c) => c.id === activeConversationId,
    );
    const hasMessages = messages.length > 0;

    return (
        <div className="h-full flex overflow-hidden bg-app-bg font-sans relative">
            {/* ─── Backdrop (sidebar mode only) ────────────────── */}
            {isSidebar && sidebarOpen && (
                <div
                    className="absolute inset-0 z-20 backdrop-blur-sm bg-app-bg/60"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* ─── Sidebar ─────────────────────────────────────── */}
            <div
                className={
                    isSidebar
                        ? // Overlay drawer mode — floats above the chat, doesn't squeeze it
                          `absolute top-0 left-0 h-full z-30 flex flex-col bg-app-surface border-r border-app-border shadow-xl transition-all duration-200 ${
                              sidebarOpen
                                  ? "w-64 opacity-100 translate-x-0"
                                  : "w-64 opacity-0 -translate-x-full pointer-events-none"
                          }`
                        : // Normal flex mode — sits beside the chat
                          `shrink-0 border-r border-app-border bg-app-surface/50 flex flex-col transition-all duration-200 ${
                              sidebarOpen
                                  ? "w-64"
                                  : "w-0 overflow-hidden border-r-0"
                          }`
                }
            >
                {/* Sidebar Header */}
                <div className="p-3 flex items-center gap-2 border-b border-app-border/50">
                    <button
                        type="button"
                        onClick={createNewChat}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-app-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                        <MessageSquarePlus className="w-4 h-4" />
                        New Chat
                    </button>
                </div>

                {/* Sidebar Search */}
                <div className="px-3 py-2">
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-app-surface-elevated border border-app-border/50">
                        <Search className="w-3.5 h-3.5 text-app-text-muted" />
                        <input
                            type="text"
                            placeholder="Search chats..."
                            value={sidebarSearch}
                            onChange={(e) => setSidebarSearch(e.target.value)}
                            className="flex-1 bg-transparent text-sm text-app-text-main placeholder-app-text-muted outline-none"
                        />
                    </div>
                </div>

                {/* Conversations List */}
                <div className="flex-1 overflow-y-auto px-2 py-1">
                    {filteredConversations.length === 0 ? (
                        <div className="text-center py-8 px-3">
                            <p className="text-sm text-app-text-muted">
                                {sidebarSearch
                                    ? "No matching chats"
                                    : "No conversations yet"}
                            </p>
                            <p className="text-xs text-app-text-muted mt-1">
                                Start a new chat to begin
                            </p>
                        </div>
                    ) : (
                        filteredConversations.map((convo) => (
                            <ConversationItem
                                key={convo.id}
                                conversation={convo}
                                isActive={convo.id === activeConversationId}
                                onClick={() => selectConversation(convo.id)}
                                onDelete={() =>
                                    handleDeleteConversation(convo.id)
                                }
                                onRename={(title) =>
                                    handleRenameConversation(convo.id, title)
                                }
                            />
                        ))
                    )}
                </div>
            </div>

            {/* ─── Main Chat Area ──────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Chat Header */}
                <div className="shrink-0 h-12 flex items-center justify-between px-4 border-b border-app-border/50">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-1.5 rounded-md hover:bg-app-hover transition-colors text-app-text-muted hover:text-app-text-main"
                            title={
                                sidebarOpen ? "Hide sidebar" : "Show sidebar"
                            }
                        >
                            <svg
                                className="w-4 h-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <rect
                                    x="3"
                                    y="3"
                                    width="18"
                                    height="18"
                                    rx="2"
                                />
                                <line x1="9" y1="3" x2="9" y2="21" />
                            </svg>
                        </button>
                        {activeConversation ? (
                            <span className="text-sm font-medium text-app-text-main truncate">
                                {activeConversation.title}
                            </span>
                        ) : (
                            <span className="text-sm text-app-text-muted">
                                trackmebaby AI
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={createNewChat}
                        className="p-1.5 rounded-md hover:bg-app-hover transition-colors text-app-text-muted hover:text-app-text-main"
                        title="New chat"
                    >
                        <MessageSquarePlus className="w-4 h-4" />
                    </button>
                </div>

                {/* ─── Chat Messages or Welcome ──────────────────── */}
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto">
                    {!hasMessages ? (
                        /* Welcome Screen */
                        <div className="h-full flex flex-col items-center justify-center px-6">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-app-accent/20 to-app-accent/5 border border-app-accent/20 flex items-center justify-center mb-6">
                                <Sparkles className="w-7 h-7 text-app-accent" />
                            </div>
                            <h2 className="text-2xl font-semibold text-app-text-main mb-2">
                                How can I help?
                            </h2>
                            <p className="text-sm text-app-text-muted max-w-md text-center leading-relaxed mb-8">
                                Ask about your projects, activity, or code. Use{" "}
                                <kbd className="px-1.5 py-0.5 rounded bg-app-surface-elevated border border-app-border text-xs font-mono">
                                    @
                                </kbd>{" "}
                                to tag a project for focused context.
                            </p>

                            {/* Quick Suggestions */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
                                {[
                                    "What have I been working on today?",
                                    "Summarize my uncommitted changes",
                                    "Which projects are most active?",
                                    "What's on my screen right now?",
                                ].map((suggestion) => (
                                    <button
                                        key={suggestion}
                                        type="button"
                                        className="text-left px-4 py-3 rounded-xl bg-app-surface border border-app-border/50 hover:border-app-accent/30 hover:bg-app-hover transition-all text-sm text-app-text-main"
                                        onClick={() => {
                                            setInput(suggestion);
                                            inputRef.current?.focus();
                                        }}
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* Messages */
                        <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-1">
                            {messages.map((msg) => (
                                <div key={msg.id} className="group">
                                    {msg.role === "user" ? (
                                        /* User message */
                                        <div className="flex justify-end mb-4">
                                            <div className="max-w-[85%]">
                                                {/* Tagged projects badge */}
                                                {msg.taggedProjectIds.length >
                                                    0 && (
                                                    <div className="flex justify-end gap-1 mb-1.5">
                                                        {msg.taggedProjectIds.map(
                                                            (pid: string) => {
                                                                const proj =
                                                                    projects.find(
                                                                        (p) =>
                                                                            p.id ===
                                                                            pid,
                                                                    );
                                                                return (
                                                                    <span
                                                                        key={
                                                                            pid
                                                                        }
                                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-app-accent/10 text-app-accent text-[11px] font-medium"
                                                                    >
                                                                        <Hash className="w-2.5 h-2.5" />
                                                                        {proj?.name ??
                                                                            "project"}
                                                                    </span>
                                                                );
                                                            },
                                                        )}
                                                    </div>
                                                )}
                                                <div className="bg-app-accent text-white rounded-2xl rounded-br-md px-4 py-3 text-[14px] leading-relaxed shadow-sm">
                                                    <pre className="whitespace-pre-wrap font-sans m-0 break-words">
                                                        {msg.content}
                                                    </pre>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        /* Assistant message */
                                        <div className="flex gap-3 mb-6">
                                            <div className="shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-app-accent/20 to-app-accent/5 border border-app-accent/15 flex items-center justify-center mt-0.5">
                                                <Sparkles className="w-3.5 h-3.5 text-app-accent" />
                                            </div>
                                            <div className="min-w-0 flex-1 text-[14px] text-app-text-main leading-relaxed">
                                                {renderMarkdown(msg.content)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Loading indicator */}
                            {loading && (
                                <div className="flex gap-3 mb-6">
                                    <div className="shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-app-accent/20 to-app-accent/5 border border-app-accent/15 flex items-center justify-center">
                                        <Sparkles className="w-3.5 h-3.5 text-app-accent animate-pulse" />
                                    </div>
                                    <div className="flex items-center gap-1 py-2">
                                        <div
                                            className="w-1.5 h-1.5 rounded-full bg-app-text-muted/60 animate-bounce"
                                            style={{
                                                animationDelay: "0ms",
                                            }}
                                        />
                                        <div
                                            className="w-1.5 h-1.5 rounded-full bg-app-text-muted/60 animate-bounce"
                                            style={{
                                                animationDelay: "150ms",
                                            }}
                                        />
                                        <div
                                            className="w-1.5 h-1.5 rounded-full bg-app-text-muted/60 animate-bounce"
                                            style={{
                                                animationDelay: "300ms",
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                {/* ─── Input Area ─────────────────────────────────── */}
                <div className="shrink-0 px-4 pb-4 pt-2">
                    {/* Tagged Projects Pills */}
                    {taggedProjects.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2 max-w-3xl mx-auto">
                            {taggedProjects.map((project) => (
                                <span
                                    key={project.id}
                                    className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-app-accent/10 border border-app-accent/20 text-app-accent text-xs font-medium"
                                >
                                    <Hash className="w-3 h-3" />
                                    {project.name}
                                    <button
                                        type="button"
                                        className="p-0.5 hover:bg-app-accent/20 rounded-full transition-colors"
                                        onClick={() =>
                                            removeTaggedProject(project.id)
                                        }
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="max-w-3xl mx-auto relative">
                        {/* @ Mention Popup */}
                        {showMentionPopup && (
                            <MentionPopup
                                projects={projects}
                                filter={mentionFilter}
                                onSelect={handleMentionSelect}
                                onClose={() => setShowMentionPopup(false)}
                                position={{ top: 8, left: 0 }}
                            />
                        )}

                        <div className="bg-app-surface-elevated rounded-2xl border border-app-border shadow-app-sm">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask anything... (use @ to tag projects)"
                                disabled={loading}
                                rows={1}
                                className="w-full resize-none bg-transparent text-app-text-main placeholder-app-text-muted text-[14px] leading-relaxed px-4 pt-3 pb-1 outline-none min-h-[40px] max-h-[160px]"
                            />

                            {/* Action Bar */}
                            <div className="flex items-center justify-between px-3 pb-2 pt-0.5">
                                <div className="flex items-center gap-1 text-app-text-muted">
                                    <button
                                        type="button"
                                        className="p-1.5 hover:bg-app-hover rounded-md transition-colors text-xs flex items-center gap-1"
                                        onClick={() => {
                                            setInput(input + "@");
                                            setShowMentionPopup(true);
                                            setMentionFilter("");
                                            inputRef.current?.focus();
                                        }}
                                        title="Tag a project"
                                    >
                                        <Hash className="w-3.5 h-3.5" />
                                    </button>
                                    {screenContext?.selectedProjectId && (
                                        <span className="text-[11px] text-app-text-muted flex items-center gap-1 px-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-app-success animate-pulse" />
                                            Seeing:{" "}
                                            {screenContext.selectedProjectName ??
                                                "project"}
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={sendMessage}
                                    disabled={loading || !input.trim()}
                                    className="w-7 h-7 rounded-lg bg-app-accent hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all shadow-sm"
                                >
                                    <ArrowUp
                                        className="w-4 h-4"
                                        strokeWidth={2.5}
                                    />
                                </button>
                            </div>
                        </div>

                        <p className="text-center text-[11px] text-app-text-muted/50 mt-2">
                            AI can make mistakes. Verify important information.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
