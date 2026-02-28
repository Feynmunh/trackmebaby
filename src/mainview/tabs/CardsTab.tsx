import { useEffect, useState } from "react";
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
                // Small delay to ensure DB is flushed
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
            // Small delay to ensure DB is flushed
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
    const normalizedSearch = search.trim().toLowerCase();

    return (
        <div className="relative h-full w-full overflow-hidden">
            {/* Grid View */}
            <div
                className={`h-full w-full px-10 py-10 overflow-y-auto ${viewMode === "grid" ? "opacity-100" : "opacity-0 pointer-events-none absolute"}`}
            >
                <div className="max-w-6xl mx-auto mb-6">
                    <label
                        htmlFor="projects-search"
                        className="text-[10px] font-bold text-mac-secondary uppercase tracking-[0.2em]"
                    >
                        Search Projects
                    </label>
                    <input
                        id="projects-search"
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Filter by name"
                        className="mt-2 w-full bg-mac-surface border border-mac-border rounded-xl px-4 py-2 text-[13px] text-mac-text placeholder-mac-secondary focus:outline-none focus:ring-2 focus:ring-mac-accent/30"
                    />
                </div>
                <ProjectsGrid
                    projects={projects.filter((project) =>
                        project.name.toLowerCase().includes(normalizedSearch),
                    )}
                    gitSnapshots={gitSnapshots}
                    onOpenDashboard={openDashboard}
                />
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
