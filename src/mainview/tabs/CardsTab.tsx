import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ProjectDashboard from "../features/projects/components/ProjectDashboard.tsx";
import ProjectsEmptyState from "../features/projects/components/ProjectsEmptyState.tsx";
import ProjectsGrid from "../features/projects/components/ProjectsGrid.tsx";
import { useProjectData } from "../hooks/useProjectData.ts";
import { useSwipeGesture } from "../hooks/useSwipeGesture.ts";
import { deleteProject, getSettings, scanProjects, selectFolder } from "../rpc";

const scoreFuzzyMatch = (query: string, text: string): number | null => {
    if (!query) {
        return 0;
    }

    let score = 0;
    let queryIndex = 0;
    let textIndex = 0;
    let consecutive = 0;

    while (queryIndex < query.length && textIndex < text.length) {
        if (query[queryIndex] === text[textIndex]) {
            score += 10 + consecutive * 5;
            consecutive += 1;
            queryIndex += 1;
        } else {
            consecutive = 0;
        }
        textIndex += 1;
    }

    if (queryIndex < query.length) {
        return null;
    }

    return score - (text.length - query.length);
};

export default function CardsTab({
    onNavigateToSettings,
    onDashboardStateChange,
}: {
    onNavigateToSettings?: () => void;
    onDashboardStateChange?: (inDashboard: boolean) => void;
}) {
    const {
        projects,
        gitSnapshots,
        projectEvents,
        projectStats,
        projectActivitySummary,
        statsLoading,
        lastUpdated,
        loading,
        viewMode,
        activeIndex,
        fetchStatsForProject,
        openDashboard,
        closeDashboard,
        loadProjects,
    } = useProjectData();

    // Notify parent when dashboard state changes so it can disable tab-level swipe
    useEffect(() => {
        onDashboardStateChange?.(viewMode === "dashboard");
    }, [viewMode, onDashboardStateChange]);

    const containerRef = useRef<HTMLDivElement>(null);

    const [selectingFolder, setSelectingFolder] = useState(false);
    const [search, setSearch] = useState("");
    const [aiRefreshKeys, setAiRefreshKeys] = useState<Record<string, number>>(
        {},
    );

    // Swipe left (two-finger swipe left) = go back to grid from dashboard
    useSwipeGesture(containerRef, {
        enabled: viewMode === "dashboard",
        onSwipeLeft: closeDashboard,
    });

    const trimmedSearch = search.trim();
    const normalizedSearch = trimmedSearch.toLowerCase();

    const filteredProjects = useMemo(() => {
        if (!normalizedSearch) {
            return projects;
        }

        const scored = projects
            .map((project) => {
                const nameScore = scoreFuzzyMatch(
                    normalizedSearch,
                    project.name.toLowerCase(),
                );
                const pathScore = scoreFuzzyMatch(
                    normalizedSearch,
                    project.path.toLowerCase(),
                );
                const score = Math.max(
                    nameScore ?? Number.NEGATIVE_INFINITY,
                    pathScore ?? Number.NEGATIVE_INFINITY,
                );

                if (score === Number.NEGATIVE_INFINITY) {
                    return null;
                }

                return { project, score };
            })
            .filter(
                (
                    entry,
                ): entry is {
                    project: (typeof projects)[number];
                    score: number;
                } => Boolean(entry),
            );

        scored.sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }

            return a.project.name.localeCompare(b.project.name);
        });

        return scored.map((entry) => entry.project);
    }, [normalizedSearch, projects]);

    const handleSelectFolder = async () => {
        setSelectingFolder(true);
        try {
            const settings = await getSettings();
            const selected = await selectFolder(settings.basePath || undefined);
            if (selected) {
                await scanProjects(selected);
                // Small delay to allow the DB write from scanProjects to flush before reload
                await new Promise((resolve) => setTimeout(resolve, 100));
                window.location.reload();
            }
        } finally {
            setSelectingFolder(false);
        }
    };

    const handleRefreshStats = (projectId: string) => {
        fetchStatsForProject(projectId, true);
        setAiRefreshKeys((prev) => ({
            ...prev,
            [projectId]: (prev[projectId] ?? 0) + 1,
        }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-app-accent border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-app-text-muted">
                        Loading projects...
                    </p>
                </div>
            </div>
        );
    }

    if (projects.length === 0) {
        return (
            <ProjectsEmptyState
                selectingFolder={selectingFolder}
                onSelectFolder={handleSelectFolder}
            />
        );
    }

    return (
        <div
            ref={containerRef}
            className="relative h-full w-full overflow-hidden"
        >
            <div
                className={`h-full w-full px-10 py-10 overflow-y-auto ${viewMode === "grid" ? "opacity-100" : "opacity-0 pointer-events-none absolute"}`}
            >
                <div className="max-w-6xl mx-auto mb-5">
                    <div className="flex items-center justify-between mb-3">
                        <h1 className="text-[32px] font-bold text-app-text-main leading-tight tracking-wide">
                            Projects
                        </h1>
                        <div className="text-xs font-medium text-app-text-muted border border-app-border bg-transparent px-3 py-1.5 rounded-full">
                            {filteredProjects.length} PROJECTS
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-app-text-muted pointer-events-none" />
                        <input
                            id="projects-search"
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search projects..."
                            aria-label="Search projects"
                            className="w-full bg-app-surface border border-app-border rounded-xl pl-8 pr-4 py-2.5 text-[13px] text-app-text-main placeholder-app-text-muted focus:outline-none focus:ring-2 focus:ring-app-accent/30"
                        />
                    </div>
                </div>
                <ProjectsGrid
                    projects={filteredProjects}
                    gitSnapshots={gitSnapshots}
                    onOpenDashboard={openDashboard}
                    onDeleteProject={async (projectId) => {
                        try {
                            await deleteProject(projectId);
                            await loadProjects();
                        } catch (err) {
                            console.error("Failed to delete project:", err);
                        }
                    }}
                />
            </div>

            <div
                className={`absolute inset-0 h-full w-full bg-app-bg transition-all duration-500 ${viewMode === "dashboard" ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0 pointer-events-none"}`}
            >
                {projects[activeIndex] && (
                    <div className="h-full w-full relative">
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
                                handleRefreshStats(projects[activeIndex].id)
                            }
                            aiRefreshKey={
                                aiRefreshKeys[projects[activeIndex].id] ?? 0
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
