import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ProjectDashboard from "../features/projects/components/ProjectDashboard.tsx";
import ProjectsEmptyState from "../features/projects/components/ProjectsEmptyState.tsx";
import ProjectsGrid from "../features/projects/components/ProjectsGrid.tsx";
import { useProjectData } from "../hooks/useProjectData.ts";
import {
    getPlatform,
    getSettings,
    scanProjects,
    selectFolder,
    updateSettings,
} from "../rpc";

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
}: {
    onNavigateToSettings?: () => void;
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
    } = useProjectData();

    const [platform, setPlatform] = useState<string>("");
    const [selectingFolder, setSelectingFolder] = useState(false);
    const [basePathInput, setBasePathInput] = useState("");
    const [savingPath, setSavingPath] = useState(false);
    const [search, setSearch] = useState("");

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

    useEffect(() => {
        getPlatform().then(setPlatform);
    }, []);

    const isLinux = platform === "linux";

    const handleSelectFolder = async () => {
        setSelectingFolder(true);
        try {
            const settings = await getSettings();
            const selected = await selectFolder(settings.basePath || undefined);
            if (selected) {
                await scanProjects(selected);
                await new Promise((resolve) => setTimeout(resolve, 100));
                window.location.reload();
            }
        } finally {
            setSelectingFolder(false);
        }
    };

    const handleSavePath = async () => {
        if (!basePathInput.trim()) return;
        setSavingPath(true);
        try {
            await updateSettings({ basePath: basePathInput.trim() });
            await scanProjects(basePathInput.trim());
            await new Promise((resolve) => setTimeout(resolve, 100));
            window.location.reload();
        } catch (err) {
            console.error("Failed to save path:", err);
        } finally {
            setSavingPath(false);
        }
    };

    if (loading) {
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
            <ProjectsEmptyState
                isLinux={isLinux}
                basePathInput={basePathInput}
                onBasePathChange={setBasePathInput}
                onSavePath={handleSavePath}
                savingPath={savingPath}
                selectingFolder={selectingFolder}
                onSelectFolder={handleSelectFolder}
            />
        );
    }

    return (
        <div className="relative h-full w-full overflow-hidden">
            <div
                className={`h-full w-full px-10 py-10 overflow-y-auto ${viewMode === "grid" ? "opacity-100" : "opacity-0 pointer-events-none absolute"}`}
            >
                <div className="max-w-6xl mx-auto mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h1 className="text-3xl font-bold text-mac-text">
                                Projects
                            </h1>
                            <p className="text-mac-secondary text-sm mt-1">
                                Select a project for details
                            </p>
                        </div>
                        <div className="text-xs font-medium text-mac-secondary bg-mac-surface px-3 py-1.5 rounded-full shadow-mac-sm">
                            {filteredProjects.length} PROJECTS
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-mac-secondary pointer-events-none" />
                        <input
                            id="projects-search"
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Filter by name"
                            className="w-full bg-mac-surface border border-mac-border rounded-xl pl-8 pr-4 py-2 text-[13px] text-mac-text placeholder-mac-secondary focus:outline-none focus:ring-2 focus:ring-mac-accent/30"
                        />
                    </div>
                </div>
                <ProjectsGrid
                    projects={filteredProjects}
                    gitSnapshots={gitSnapshots}
                    onOpenDashboard={openDashboard}
                />
            </div>

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
