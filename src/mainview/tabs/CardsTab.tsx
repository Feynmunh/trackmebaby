import { useCallback, useEffect, useRef, useState } from "react";
import { toErrorData } from "../../shared/error.ts";
import { createLogger } from "../../shared/logger.ts";
import { nowIso, timeAgo } from "../../shared/time.ts";
import type {
    ActivityEvent,
    ActivitySummary,
    GitSnapshot,
    Project,
    ProjectStats,
} from "../../shared/types.ts";
import ProjectDashboard from "../components/ProjectDashboard";

const logger = createLogger("cards-tab");

// Try to import RPC, fallback to mock for dev/build
let rpcApi: {
    getProjects: () => Promise<Project[]>;
    getGitStatus: (id: string) => Promise<GitSnapshot | null>;
    getProjectStats: (id: string) => Promise<ProjectStats | null>;
    getProjectActivity: (id: string, since: string) => Promise<ActivityEvent[]>;
    getProjectActivitySummary: (
        id: string,
        since: string,
        until: string,
    ) => Promise<ActivitySummary[]>;
    scanProjects: (basePath: string) => Promise<Project[]>;
} | null = null;

try {
    rpcApi = await import("../rpc.ts");
} catch (err: unknown) {
    logger.warn("rpc not available", { error: toErrorData(err) });
}

export default function CardsTab({
    onNavigateToSettings,
}: {
    onNavigateToSettings?: () => void;
}) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [gitSnapshots, setGitSnapshots] = useState<
        Record<string, GitSnapshot | null>
    >({});
    const [projectEvents, setProjectEvents] = useState<
        Record<string, ActivityEvent[]>
    >({});
    const [projectStats, setProjectStats] = useState<
        Record<string, ProjectStats | null>
    >({});
    const [projectActivitySummary, setProjectActivitySummary] = useState<
        Record<string, ActivitySummary[]>
    >({});
    const [statsLoading, setStatsLoading] = useState<Record<string, boolean>>(
        {},
    );
    const projectStatsRef = useRef<Record<string, ProjectStats | null>>({});
    const statsLoadingRef = useRef<Record<string, boolean>>({});
    const statsRetryRef = useRef<Record<string, number>>({});
    const lastUpdatedRef = useRef<Record<string, string>>({});
    const [lastUpdated, setLastUpdated] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"grid" | "dashboard">("grid");
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        loadProjects();
    }, [loadProjects]);

    useEffect(() => {
        projectStatsRef.current = projectStats;
    }, [projectStats]);

    useEffect(() => {
        statsLoadingRef.current = statsLoading;
    }, [statsLoading]);

    const refreshActiveProject = useCallback(async (projectId: string) => {
        if (!rpcApi) return;
        try {
            const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const until = new Date();
            const [snapshot, events, summary] = await Promise.all([
                rpcApi.getGitStatus(projectId),
                rpcApi.getProjectActivity(projectId, since.toISOString()),
                rpcApi.getProjectActivitySummary(
                    projectId,
                    since.toISOString(),
                    until.toISOString(),
                ),
            ]);
            setGitSnapshots((prev) => ({ ...prev, [projectId]: snapshot }));
            setProjectEvents((prev) => ({ ...prev, [projectId]: events }));
            setProjectActivitySummary((prev) => ({
                ...prev,
                [projectId]: summary,
            }));
        } catch (err: unknown) {
            logger.error("failed to refresh project data", {
                projectId,
                error: toErrorData(err),
            });
        }
    }, []);

    async function loadProjects() {
        if (!rpcApi) {
            setLoading(false);
            return;
        }

        try {
            const projs = await rpcApi.getProjects();
            // Sort by activity
            const sortedProjs = [...projs].sort(
                (a, b) =>
                    new Date(b.lastActivityAt ?? 0).getTime() -
                    new Date(a.lastActivityAt ?? 0).getTime(),
            );
            setProjects(sortedProjs);

            const snapshots: Record<string, GitSnapshot | null> = {};
            const events: Record<string, ActivityEvent[]> = {};
            const summaries: Record<string, ActivitySummary[]> = {};

            // Initial load: lightweight data for all
            for (const proj of sortedProjs) {
                try {
                    snapshots[proj.id] = await rpcApi.getGitStatus(proj.id);
                } catch (err: unknown) {
                    logger.warn("failed to load git snapshot", {
                        projectId: proj.id,
                        error: toErrorData(err),
                    });
                    snapshots[proj.id] = null;
                }

                try {
                    const since = new Date();
                    since.setDate(since.getDate() - 7); // 7 days of activity
                    const until = new Date();
                    const [eventList, summary] = await Promise.all([
                        rpcApi.getProjectActivity(proj.id, since.toISOString()),
                        rpcApi.getProjectActivitySummary(
                            proj.id,
                            since.toISOString(),
                            until.toISOString(),
                        ),
                    ]);
                    events[proj.id] = eventList;
                    summaries[proj.id] = summary;
                } catch (err: unknown) {
                    logger.warn("failed to load activity", {
                        projectId: proj.id,
                        error: toErrorData(err),
                    });
                    events[proj.id] = [];
                    summaries[proj.id] = [];
                }
            }

            setGitSnapshots(snapshots);
            setProjectEvents(events);
            setProjectActivitySummary(summaries);
        } catch (err: unknown) {
            logger.error("failed to load projects", {
                error: toErrorData(err),
            });
        } finally {
            setLoading(false);
        }
    }

    const fetchStatsForProject = useCallback(
        async (projectId: string, force: boolean = false) => {
            if (!rpcApi) return;
            if (statsLoadingRef.current[projectId]) return;
            if (!force && projectStatsRef.current[projectId]) return;

            setStatsLoading((prev) => ({ ...prev, [projectId]: true }));

            try {
                const stats = await rpcApi.getProjectStats(projectId);
                if (stats) {
                    statsRetryRef.current[projectId] = 0;
                    setProjectStats((prev) => ({
                        ...prev,
                        [projectId]: stats,
                    }));
                    const now = nowIso();
                    lastUpdatedRef.current[projectId] = now;
                    setLastUpdated((prev) => ({ ...prev, [projectId]: now }));
                } else {
                    const retries = (statsRetryRef.current[projectId] ?? 0) + 1;
                    statsRetryRef.current[projectId] = retries;
                    if (retries <= 3) {
                        setTimeout(
                            () => fetchStatsForProject(projectId, true),
                            400 * retries,
                        );
                    }
                }
            } catch (err: unknown) {
                logger.error("failed to fetch stats", {
                    projectId,
                    error: toErrorData(err),
                });
                const retries = (statsRetryRef.current[projectId] ?? 0) + 1;
                statsRetryRef.current[projectId] = retries;
                if (retries <= 3) {
                    setTimeout(
                        () => fetchStatsForProject(projectId, true),
                        400 * retries,
                    );
                }
            } finally {
                setStatsLoading((prev) => ({ ...prev, [projectId]: false }));
            }
        },
        [],
    );

    const openDashboard = (projectId: string) => {
        const index = projects.findIndex((p) => p.id === projectId);
        if (index === -1) return;

        setActiveIndex(index);
        setViewMode("dashboard");
        fetchStatsForProject(projectId, true);
        refreshActiveProject(projectId);
    };

    useEffect(() => {
        if (viewMode !== "dashboard") return;
        const projectId = projects[activeIndex]?.id;
        if (!projectId) return;
        fetchStatsForProject(projectId, true);
        const interval = setInterval(() => {
            fetchStatsForProject(projectId, false);
        }, 60000);
        return () => clearInterval(interval);
    }, [viewMode, activeIndex, projects, fetchStatsForProject]);

    const closeDashboard = () => {
        setViewMode("grid");
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && viewMode === "dashboard") {
                closeDashboard();
            }
        };

        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [viewMode, closeDashboard]);

    if (loading) {
        // ... loading state ...
        return (
            <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-mac-accent border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-mac-secondary">
                        Loading projects...
                    </p>
                </div>
            </div>
        );
    }

    if (projects.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
                <div className="bg-mac-surface rounded-2xl p-12 shadow-mac-md flex flex-col items-center max-w-md">
                    <div className="w-16 h-16 rounded-2xl bg-mac-bg flex items-center justify-center mb-5">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.5}
                            className="w-8 h-8 text-mac-secondary"
                        >
                            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-mac-text mb-2">
                        No projects yet
                    </h2>
                    <p className="text-mac-secondary text-sm mb-6 leading-relaxed">
                        Set your base folder in Settings to start tracking your
                        projects automatically.
                    </p>
                    <button
                        className="bg-mac-accent text-white font-medium px-5 py-2.5 rounded-lg hover:opacity-90 active:scale-[0.98] transition-all shadow-mac"
                        onClick={() =>
                            document.getElementById("tab-settings")?.click()
                        }
                    >
                        Open Settings
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="relative h-full w-full overflow-hidden">
            {/* Grid View */}
            <div
                className={`h-full w-full p-8 transition-all duration-500 overflow-y-auto ${viewMode === "grid" ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none absolute"}`}
            >
                <div className="max-w-6xl mx-auto">
                    <header className="mb-10 flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-mac-text">
                                Projects
                            </h1>
                            <p className="text-mac-secondary text-sm mt-1">
                                Select a project for details
                            </p>
                        </div>
                        <div className="text-xs font-medium text-mac-secondary bg-mac-surface px-3 py-1.5 rounded-full shadow-mac-sm">
                            {projects.length} PROJECTS
                        </div>
                    </header>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.map((project) => {
                            const snapshot = gitSnapshots[project.id];
                            return (
                                <div
                                    key={project.id}
                                    onClick={() => openDashboard(project.id)}
                                    className="bg-mac-surface rounded-2xl p-6 shadow-mac border border-mac-border hover:shadow-mac-md transition-all duration-200 cursor-pointer group active:scale-[0.98]"
                                >
                                    <h3 className="text-lg font-semibold text-mac-text mb-4 group-hover:text-mac-accent transition-colors">
                                        {project.name}
                                    </h3>
                                    {snapshot && (
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {snapshot.uncommittedCount > 0 ? (
                                                <span className="text-[10px] font-bold uppercase tracking-wider bg-mac-accent/10 text-mac-accent px-2 py-0.5 rounded border border-mac-accent/20">
                                                    {snapshot.uncommittedCount}{" "}
                                                    changes
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold uppercase tracking-wider bg-mac-bg text-mac-secondary px-2 py-0.5 rounded border border-mac-border">
                                                    0 changes
                                                </span>
                                            )}
                                            {project.worktrees &&
                                                project.worktrees.length >
                                                    1 && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded border border-purple-500/20">
                                                        {
                                                            project.worktrees
                                                                .length
                                                        }{" "}
                                                        worktrees
                                                    </span>
                                                )}
                                        </div>
                                    )}

                                    <div className="mt-auto pt-4 border-t border-mac-border flex items-center justify-between">
                                        <span className="text-xs text-mac-secondary">
                                            {project.lastActivityAt
                                                ? timeAgo(
                                                      project.lastActivityAt,
                                                      {
                                                          emptyLabel:
                                                              "Never active",
                                                          justNowLabel:
                                                              "Just now",
                                                          maxDays:
                                                              Number.POSITIVE_INFINITY,
                                                      },
                                                  )
                                                : "Never active"}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Dashboard View */}
            <div
                className={`absolute inset-0 h-full w-full bg-mac-bg transition-all duration-500 ${viewMode === "dashboard" ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0 pointer-events-none"}`}
            >
                {projects[activeIndex] && (
                    <div className="h-full w-full">
                        <ProjectDashboard
                            project={projects[activeIndex]}
                            gitSnapshot={gitSnapshots[projects[activeIndex].id]}
                            projectStats={
                                projectStats[projects[activeIndex].id]
                            }
                            events={
                                projectEvents[projects[activeIndex].id] ?? []
                            }
                            activitySummary={
                                projectActivitySummary[projects[activeIndex].id]
                            }
                            statsLoading={
                                statsLoading[projects[activeIndex].id] ?? false
                            }
                            statsLastUpdated={
                                lastUpdated[projects[activeIndex].id]
                            }
                            onRefreshStats={() =>
                                fetchStatsForProject(
                                    projects[activeIndex].id,
                                    true,
                                )
                            }
                            onBack={closeDashboard}
                            onNavigateToSettings={onNavigateToSettings}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
