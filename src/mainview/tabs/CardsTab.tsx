import { FolderOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { timeAgo } from "../../shared/time.ts";
import ProjectDashboard from "../components/ProjectDashboard";
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
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
                <div className="bg-mac-surface rounded-2xl p-12 shadow-mac-md flex flex-col items-center max-w-md">
                    <div className="w-16 h-16 rounded-2xl bg-mac-bg flex items-center justify-center mb-5">
                        <FolderOpen className="w-8 h-8 text-mac-secondary" />
                    </div>
                    <h2 className="text-xl font-semibold text-mac-text mb-2">
                        {isLinux
                            ? "Enter your project folder path"
                            : "Select your project folder"}
                    </h2>
                    <p className="text-mac-secondary text-sm mb-6 leading-relaxed">
                        {isLinux
                            ? "Enter the full path to your projects folder (e.g., /home/username/projects or ~/projects)"
                            : "Choose a folder containing your projects to start tracking your work automatically."}
                    </p>
                    {isLinux ? (
                        <div className="flex flex-col gap-2 w-full max-w-xs">
                            <input
                                type="text"
                                value={basePathInput}
                                onChange={(e) =>
                                    setBasePathInput(e.target.value)
                                }
                                placeholder="/home/username/projects or ~/projects"
                                className="w-full bg-mac-bg border border-black/20 dark:border-white/10 rounded-lg px-3 py-2 text-[14px] text-mac-text placeholder-mac-secondary focus:ring-2 focus:ring-mac-accent/30 outline-none transition-all"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleSavePath();
                                    }
                                }}
                            />
                            <button
                                className="bg-mac-accent text-white font-medium px-5 py-2.5 rounded-lg hover:opacity-90 active:scale-[0.98] transition-all shadow-mac flex items-center justify-center gap-2 disabled:opacity-50"
                                onClick={handleSavePath}
                                disabled={savingPath || !basePathInput.trim()}
                            >
                                {savingPath ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <FolderOpen size={18} />
                                        Save & Scan
                                    </>
                                )}
                            </button>
                        </div>
                    ) : (
                        <button
                            className="bg-mac-accent text-white font-medium px-5 py-2.5 rounded-lg hover:opacity-90 active:scale-[0.98] transition-all shadow-mac flex items-center gap-2"
                            onClick={handleSelectFolder}
                            disabled={selectingFolder}
                        >
                            {selectingFolder ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Selecting...
                                </>
                            ) : (
                                <>
                                    <FolderOpen size={18} />
                                    Select Folder
                                </>
                            )}
                        </button>
                    )}
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
