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

            // Load git status and recent files for each project
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
            <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center animate-pulse">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-white">
                            <rect x="3" y="3" width="7" height="7" rx="1" />
                            <rect x="14" y="3" width="7" height="7" rx="1" />
                            <rect x="3" y="14" width="7" height="7" rx="1" />
                            <rect x="14" y="14" width="7" height="7" rx="1" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white">Projects</h1>
                        <p className="text-sm text-gray-400">Loading...</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-40 rounded-2xl bg-gray-900/50 border border-gray-800/40 animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-white">
                            <rect x="3" y="3" width="7" height="7" rx="1" />
                            <rect x="14" y="3" width="7" height="7" rx="1" />
                            <rect x="3" y="14" width="7" height="7" rx="1" />
                            <rect x="14" y="14" width="7" height="7" rx="1" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white">Projects</h1>
                        <p className="text-sm text-gray-400">
                            {projects.length > 0
                                ? `${projects.length} tracked project${projects.length !== 1 ? "s" : ""}`
                                : "Your tracked projects"}
                        </p>
                    </div>
                </div>
                {projects.length > 0 && (
                    <button
                        onClick={loadProjects}
                        className="p-2 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                        title="Refresh"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H4.598a.75.75 0 00-.75.75v3.634a.75.75 0 001.5 0v-2.009l.312.311a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm-6.624-7.2a5.5 5.5 0 019.201-2.466l.312.311H15.77a.75.75 0 000 1.5h3.634a.75.75 0 00.75-.75V-.815a.75.75 0 00-1.5 0v2.008l-.312-.31a7 7 0 00-11.712 3.138.75.75 0 001.449.39z" clipRule="evenodd" />
                        </svg>
                    </button>
                )}
            </div>

            {projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gray-800/50 flex items-center justify-center mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth={1.5} className="w-8 h-8 text-gray-600">
                            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-semibold text-gray-400 mb-2">No projects yet</h2>
                    <p className="text-sm text-gray-500 max-w-xs">
                        Set your base folder in Settings to start tracking your projects automatically.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
