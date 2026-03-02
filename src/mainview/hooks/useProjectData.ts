import { useCallback, useEffect, useRef, useState } from "react";
import { toErrorData } from "../../shared/error.ts";
import { createLogger } from "../../shared/logger.ts";
import { nowIso } from "../../shared/time.ts";
import type {
    ActivityEvent,
    ActivitySummary,
    GitSnapshot,
    Project,
    ProjectStats,
} from "../../shared/types.ts";

const logger = createLogger("cards-tab");

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
    onProjectView: (
        projectId: string,
    ) => Promise<{ success: boolean; insightCount: number; reason: string }>;
} | null = null;

async function loadRpcApi(): Promise<void> {
    if (rpcApi) return;
    try {
        rpcApi = await import("../rpc.ts");
    } catch (err: unknown) {
        logger.warn("rpc not available", { error: toErrorData(err) });
    }
}

interface UseProjectDataResult {
    projects: Project[];
    gitSnapshots: Record<string, GitSnapshot | null>;
    projectEvents: Record<string, ActivityEvent[]>;
    projectStats: Record<string, ProjectStats | null>;
    projectActivitySummary: Record<string, ActivitySummary[]>;
    statsLoading: Record<string, boolean>;
    lastUpdated: Record<string, string>;
    loading: boolean;
    viewMode: "grid" | "dashboard";
    setViewMode: (mode: "grid" | "dashboard") => void;
    activeIndex: number;
    setActiveIndex: (index: number) => void;
    fetchStatsForProject: (projectId: string, force?: boolean) => Promise<void>;
    refreshActiveProject: (projectId: string) => Promise<void>;
    openDashboard: (projectId: string) => void;
    closeDashboard: () => void;
}

export function useProjectData(): UseProjectDataResult {
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

    const refreshActiveProject = useCallback(async (projectId: string) => {
        await loadRpcApi();
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

    const loadProjects = useCallback(async () => {
        await loadRpcApi();
        if (!rpcApi) {
            setLoading(false);
            return;
        }

        try {
            const projs = await rpcApi.getProjects();
            const sortedProjs = [...projs].sort(
                (a, b) =>
                    new Date(b.lastActivityAt ?? 0).getTime() -
                    new Date(a.lastActivityAt ?? 0).getTime(),
            );
            setProjects(sortedProjs);

            const snapshots: Record<string, GitSnapshot | null> = {};
            const events: Record<string, ActivityEvent[]> = {};
            const summaries: Record<string, ActivitySummary[]> = {};

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
                    since.setDate(since.getDate() - 7);
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
    }, []);

    const fetchStatsForProject = useCallback(
        async (projectId: string, force: boolean = false) => {
            await loadRpcApi();
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

    const openDashboard = useCallback(
        (projectId: string) => {
            const index = projects.findIndex((p) => p.id === projectId);
            if (index === -1) return;

            setActiveIndex(index);
            setViewMode("dashboard");
            fetchStatsForProject(projectId, true);
            refreshActiveProject(projectId);
        },
        [fetchStatsForProject, projects, refreshActiveProject],
    );

    const closeDashboard = useCallback(() => {
        setViewMode("grid");
    }, []);

    useEffect(() => {
        loadProjects();
    }, [loadProjects]);

    useEffect(() => {
        projectStatsRef.current = projectStats;
    }, [projectStats]);

    useEffect(() => {
        statsLoadingRef.current = statsLoading;
    }, [statsLoading]);

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

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && viewMode === "dashboard") {
                closeDashboard();
            }
        };

        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [viewMode, closeDashboard]);

    return {
        projects,
        gitSnapshots,
        projectEvents,
        projectStats,
        projectActivitySummary,
        statsLoading,
        lastUpdated,
        loading,
        viewMode,
        setViewMode,
        activeIndex,
        setActiveIndex,
        fetchStatsForProject,
        refreshActiveProject,
        openDashboard,
        closeDashboard,
    };
}
