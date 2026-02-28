import { Folder, FolderOpen, GitBranch, Search } from "lucide-react";
import { useEffect, useState } from "react";
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
                className={`h-full w-full px-10 py-10 overflow-y-auto ${viewMode === "grid" ? "opacity-100" : "opacity-0 pointer-events-none absolute"}`}
            >
                <div className="max-w-5xl mx-auto">
                    <header className="mb-8">
                        <div className="flex items-start justify-between mb-4">
                            <h1 className="text-[32px] font-bold text-mac-text leading-tight">
                                Projects
                            </h1>
                            <div className="text-[11px] font-semibold text-mac-secondary bg-transparent px-3 py-1.5 rounded-full border border-mac-border tracking-wide mt-2">
                                {projects.length} PROJECTS
                            </div>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-mac-secondary pointer-events-none" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search projects..."
                                className="w-full bg-transparent border border-mac-border rounded-lg pl-8 pr-4 py-2 text-[13px] text-mac-text placeholder-mac-secondary focus:outline-none focus:border-mac-accent/30"
                            />
                        </div>
                    </header>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())).map((project) => {
                            const snapshot = gitSnapshots[project.id];
                            const isSynced = snapshot ? snapshot.uncommittedCount === 0 : false;
                            return (
                                <div
                                    key={project.id}
                                    onClick={() => openDashboard(project.id)}
                                    className="bg-transparent border border-mac-border rounded-xl p-6 cursor-pointer hover:border-mac-accent/20"
                                >
                                    {/* Row 1: icon + name + active badge */}
                                    <div className="flex items-start justify-between mb-1">
                                        <div className="flex items-start gap-3">
                                            <Folder className="w-5 h-5 text-mac-secondary mt-0.5 shrink-0" />
                                            <div>
                                                <h3 className="text-[17px] font-semibold text-mac-text leading-tight">
                                                    {project.name}
                                                </h3>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 2: branch + synced */}
                                    {snapshot && (
                                        <div className="flex items-center gap-2 mt-4 mb-5 ml-8">
                                            <div className="flex items-center gap-1.5 border border-mac-border rounded px-2 py-0.5">
                                                <GitBranch className="w-3 h-3 text-mac-secondary" />
                                                <span className="text-[12px] text-mac-secondary max-w-[90px] truncate">
                                                    {snapshot.branch}
                                                </span>
                                            </div>
                                            <span
                                                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded ${
                                                    isSynced
                                                        ? "bg-orange-500/15 text-orange-400/70"
                                                        : "bg-orange-900/20 text-orange-500/60"
                                                }`}
                                            >
                                                {isSynced
                                                    ? "SYNCED"
                                                    : `${snapshot.uncommittedCount} CHANGES`}
                                            </span>
                                        </div>
                                    )}

                                    {/* Row 3: last commit */}
                                    {snapshot?.lastCommitMessage && (
                                        <div className="ml-8">
                                            <p className="text-[10px] text-mac-secondary uppercase tracking-[0.15em] mb-1">
                                                LAST COMMIT
                                            </p>
                                            <p className="text-[13px] text-mac-secondary leading-snug">
                                                {snapshot.lastCommitMessage}
                                            </p>
                                        </div>
                                    )}
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
