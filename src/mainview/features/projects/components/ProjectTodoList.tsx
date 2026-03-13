import { useEffect, useRef, useState } from "react";
import type {
    ProjectTodo,
    ProjectTodoStatus,
} from "../../../../shared/types.ts";
import {
    addProjectTodo,
    deleteCompletedProjectTodos,
    deleteProjectTodo,
    getProjectTodos,
    onWardenAnalysisFailed,
    onWardenInsightsUpdated,
    updateProjectTodoStatus,
} from "../../../rpc.ts";

interface ProjectTodoListProps {
    projectId: string;
    refreshKey?: number;
}

export default function ProjectTodoList({
    projectId,
    refreshKey = 0,
}: ProjectTodoListProps) {
    const [todos, setTodos] = useState<ProjectTodo[]>([]);
    const [newTask, setNewTask] = useState("");
    const [loading, setLoading] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const fetchTodos = async () => {
        try {
            const data = await getProjectTodos(projectId);
            setTodos(data);
        } catch (err) {
            console.error("Failed to fetch todos:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        fetchTodos();

        // Listen for analysis state via Warden events (analysis is triggered by AIOverview)

        const unsubscribeUpdated = onWardenInsightsUpdated(
            (updatedProjectId) => {
                if (updatedProjectId === projectId) {
                    if (isMounted) setIsAnalyzing(false);
                    fetchTodos();
                }
            },
        );

        const unsubscribeFailed = onWardenAnalysisFailed(
            ({ projectId: failedId }) => {
                if (failedId === projectId) {
                    if (isMounted) setIsAnalyzing(false);
                }
            },
        );

        return () => {
            isMounted = false;
            unsubscribeUpdated();
            unsubscribeFailed();
        };
    }, [projectId, refreshKey]);

    const handleAddTodo = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newTask.trim()) return;

        setIsAdding(true);
        try {
            await addProjectTodo({
                projectId,
                task: newTask.trim(),
                source: "manual",
            });
            setNewTask("");
            await fetchTodos();
        } catch (err) {
            console.error("Failed to add todo:", err);
        } finally {
            setIsAdding(false);
        }
    };

    const handleOptimisticUpdate = async (
        updateFn: (prev: ProjectTodo[]) => ProjectTodo[],
        rpcFn: () => Promise<unknown>,
        errorMsg: string,
    ) => {
        try {
            setTodos(updateFn);
            await rpcFn();
            await fetchTodos();
        } catch (err) {
            console.error(errorMsg, err);
            await fetchTodos(); // Revert/Sync with server on error
        }
    };

    const handleToggleTodo = async (
        id: string,
        currentStatus: ProjectTodoStatus,
    ) => {
        const newStatus = currentStatus === "pending" ? "completed" : "pending";
        await handleOptimisticUpdate(
            (prev) =>
                prev.map((t) =>
                    t.id === id ? { ...t, status: newStatus } : t,
                ),
            () => updateProjectTodoStatus(id, newStatus),
            "Failed to update todo:",
        );
    };

    const handleDeleteTodo = async (id: string) => {
        await handleOptimisticUpdate(
            (prev) => prev.filter((t) => t.id !== id),
            () => deleteProjectTodo(id),
            "Failed to delete todo:",
        );
    };

    const handleClearCompleted = async () => {
        await handleOptimisticUpdate(
            (prev) => prev.filter((t) => t.status !== "completed"),
            () => deleteCompletedProjectTodos(projectId),
            "Failed to clear completed todos:",
        );
    };

    if (loading && todos.length === 0) {
        return (
            <div className="mt-8 space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="h-3 bg-app-border/40 rounded w-24 animate-pulse" />
                    <div className="h-3 bg-app-border/40 rounded w-10 animate-pulse" />
                </div>
                {[1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className="h-14 bg-app-border/20 rounded-xl animate-pulse flex items-center px-4 gap-3"
                    >
                        <div className="w-5 h-5 bg-app-border/40 rounded-lg flex-shrink-0" />
                        <div className="h-3 bg-app-border/40 rounded w-[70%]" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="mt-8 relative">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <h3 className="text-[10px] font-bold text-app-text-muted uppercase tracking-[0.2em]">
                        Next Steps
                    </h3>
                    {isAnalyzing && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-orange-500/10 border border-orange-500/20 rounded-full animate-pulse">
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                            <span className="text-[9px] font-bold text-orange-600 uppercase tracking-widest">
                                Analyzing
                            </span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {todos.some((t) => t.status === "completed") && (
                        <button
                            onClick={handleClearCompleted}
                            className="px-2.5 py-1 rounded-lg border border-app-accent/20 bg-app-accent/5 text-[9px] font-bold text-app-accent hover:bg-app-accent hover:text-white hover:border-app-accent uppercase tracking-widest transition-all active:scale-95"
                        >
                            Clear Completed
                        </button>
                    )}
                    <div className="bg-app-surface/40 border border-app-border/50 px-2 py-1 rounded-lg">
                        <span className="text-[10px] text-app-text-muted font-bold tabular-nums">
                            {
                                todos.filter((t) => t.status === "completed")
                                    .length
                            }{" "}
                            / {todos.length}
                        </span>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                {todos.length === 0 && !isAnalyzing ? (
                    <div className="text-center py-8 rounded-2xl border border-dashed border-app-border/50">
                        <p className="text-[12px] text-app-text-muted">
                            No pending tasks. Use the form below to add one.
                        </p>
                    </div>
                ) : (
                    todos.map((todo) => (
                        <div
                            key={todo.id}
                            className={`group flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-300 ${
                                todo.status === "completed"
                                    ? "bg-app-surface/10 border-app-border/30"
                                    : "bg-app-surface/50 border-app-border/70 hover:border-app-accent/40 hover:bg-app-surface/70 shadow-sm"
                            }`}
                        >
                            <button
                                onClick={() =>
                                    handleToggleTodo(todo.id, todo.status)
                                }
                                className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all duration-300 ${
                                    todo.status === "completed"
                                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-600"
                                        : "border-app-text-muted/40 hover:border-app-accent/50 text-transparent"
                                }`}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className={`w-3 h-3 transition-transform duration-300 ${todo.status === "completed" ? "scale-100" : "scale-0"}`}
                                >
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </button>

                            <div className="flex-grow min-w-0 flex flex-col gap-1">
                                <span
                                    className={`text-[13px] font-medium leading-tight transition-all duration-300 ${
                                        todo.status === "completed"
                                            ? "text-app-text-muted/40 line-through decoration-app-text-muted/20"
                                            : "text-app-text-main"
                                    }`}
                                >
                                    {todo.task}
                                </span>

                                <div className="flex items-center gap-2">
                                    {todo.source === "auto" && (
                                        <span
                                            className={`text-[8px] font-bold uppercase tracking-wider ${
                                                todo.status === "completed"
                                                    ? "text-app-text-muted/40"
                                                    : "text-app-accent/70"
                                            }`}
                                        >
                                            Auto-Suggested
                                        </span>
                                    )}
                                    {todo.status === "completed" &&
                                        todo.completed_at && (
                                            <span className="text-[9px] text-app-text-muted/40 font-medium">
                                                Done{" "}
                                                {new Date(
                                                    todo.completed_at,
                                                ).toLocaleDateString()}
                                            </span>
                                        )}
                                </div>
                            </div>

                            <button
                                onClick={() => handleDeleteTodo(todo.id)}
                                className="flex-shrink-0 p-1 text-app-text-muted hover:text-app-error opacity-0 group-hover:opacity-100 transition-all"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="w-3.5 h-3.5"
                                >
                                    <path d="M3 6h18" />
                                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                </svg>
                            </button>
                        </div>
                    ))
                )}

                <form
                    onSubmit={handleAddTodo}
                    className="relative flex items-center gap-2 mt-4"
                >
                    <input
                        ref={inputRef}
                        type="text"
                        value={newTask}
                        onChange={(e) => setNewTask(e.target.value)}
                        placeholder="Add a task..."
                        disabled={isAdding}
                        className="flex-grow bg-app-surface/30 border border-app-border/60 rounded-xl px-4 py-2.5 text-[13px] placeholder:text-app-text-muted/50 focus:outline-none focus:border-app-accent/50 focus:bg-app-surface/50 transition-all"
                    />
                    <button
                        type="submit"
                        disabled={isAdding || !newTask.trim()}
                        className="flex-shrink-0 p-2.5 rounded-xl bg-app-accent text-white disabled:opacity-50 disabled:bg-app-text-muted/20 transition-all hover:bg-app-accent-hover active:scale-95"
                    >
                        {isAdding ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="w-4 h-4"
                            >
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
