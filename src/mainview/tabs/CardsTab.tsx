import { useState, useEffect } from "react";
import ProjectCard from "../components/ProjectCard";
import type { Project, GitSnapshot } from "../../shared/types.ts";

// Try to import RPC, fallback to mock for dev/build
let rpcApi: {
    getProjects: () => Promise<Project[]>;
    getGitStatus: (id: string) => Promise<GitSnapshot | null>;
    getProjectActivity: (id: string, since: string) => Promise<any[]>;
    scanProjects: (basePath: string) => Promise<Project[]>;
} | null = null;

try {
    rpcApi = await import("../rpc.ts");
} catch {
    // RPC not available (outside Electrobun)
}

export default function CardsTab() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [gitSnapshots, setGitSnapshots] = useState<Record<string, GitSnapshot | null>>({});
    const [recentFiles, setRecentFiles] = useState<Record<string, string[]>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadProjects();
    }, []);

    async function loadProjects() {
        if (!rpcApi) {
            setLoading(false);
            return;
        }

        try {
            const projs = await rpcApi.getProjects();
            setProjects(projs);

            const snapshots: Record<string, GitSnapshot | null> = {};
            const files: Record<string, string[]> = {};

            for (const proj of projs) {
                try {
                    snapshots[proj.id] = await rpcApi.getGitStatus(proj.id);
                } catch {
                    snapshots[proj.id] = null;
                }

                try {
                    const since = new Date();
                    since.setHours(since.getHours() - 24);
                    const events = await rpcApi.getProjectActivity(proj.id, since.toISOString());
                    files[proj.id] = [...new Set(events.map((e: any) => e.filePath))].slice(0, 5);
                } catch {
                    files[proj.id] = [];
                }
            }

            setGitSnapshots(snapshots);
            setRecentFiles(files);
        } catch (err) {
            console.error("Failed to load projects:", err);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="p-8 max-w-6xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-2xl font-semibold text-mac-text tracking-tight">Projects</h1>
                    <p className="text-mac-secondary text-sm mt-1">Loading your workspace...</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-44 rounded-xl bg-mac-surface shadow-mac animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-mac-text tracking-tight">Projects</h1>
                    <p className="text-mac-secondary text-sm mt-0.5">
                        {projects.length > 0
                            ? `${projects.length} tracked project${projects.length !== 1 ? "s" : ""}`
                            : "Your active workspace"}
                    </p>
                </div>
                {projects.length > 0 && (
                    <button
                        onClick={loadProjects}
                        className="p-2 text-mac-secondary hover:text-mac-text hover:bg-mac-hover rounded-lg transition-all"
                        title="Refresh"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                            <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H4.598a.75.75 0 00-.75.75v3.634a.75.75 0 001.5 0v-2.009l.312.311a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm-6.624-7.2a5.5 5.5 0 019.201-2.466l.312.311H15.77a.75.75 0 000 1.5h3.634a.75.75 0 00.75-.75V-.815a.75.75 0 00-1.5 0v2.008l-.312-.31a7 7 0 00-11.712 3.138.75.75 0 001.449.39z" clipRule="evenodd" />
                        </svg>
                    </button>
                )}
            </div>

            {projects.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <div className="bg-mac-surface rounded-2xl p-12 shadow-mac-md flex flex-col items-center max-w-md">
                        <div className="w-16 h-16 rounded-2xl bg-mac-bg flex items-center justify-center mb-5">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 text-mac-secondary">
                                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-mac-text mb-2">No projects yet</h2>
                        <p className="text-mac-secondary text-sm mb-6 leading-relaxed">
                            Set your base folder in Settings to start tracking your projects automatically.
                        </p>
                        <button
                            className="bg-mac-accent text-white font-medium px-5 py-2.5 rounded-lg hover:opacity-90 active:scale-[0.98] transition-all shadow-mac"
                            onClick={() => document.getElementById('tab-settings')?.click()}
                        >
                            Open Settings
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {projects.map((project) => (
                        <ProjectCard
                            key={project.id}
                            project={project}
                            gitSnapshot={gitSnapshots[project.id]}
                            recentFiles={recentFiles[project.id]}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
