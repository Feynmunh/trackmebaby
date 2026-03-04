import { FolderOpen, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { Settings } from "../../../../shared/types.ts";
import {
    getPlatform,
    scanProjects,
    selectFolder,
    updateSettings,
} from "../../../rpc";

interface WorkspaceSectionProps {
    settings: Settings;
    onChange: (settings: Settings) => void;
}

export default function WorkspaceSection({
    settings,
    onChange,
}: WorkspaceSectionProps) {
    const [platform, setPlatform] = useState<string>("");
    const [scanning, setScanning] = useState(false);

    useEffect(() => {
        getPlatform().then(setPlatform);
    }, []);

    const isLinux = platform === "linux";

    const handleBrowse = async () => {
        console.log("[WorkspaceSection] handleBrowse called");
        try {
            const selected = await selectFolder(settings.basePath || undefined);
            console.log("[WorkspaceSection] selectFolder returned:", selected);
            if (selected) {
                onChange({
                    ...settings,
                    basePath: selected,
                });
            }
        } catch (err) {
            console.error("[WorkspaceSection] Error selecting folder:", err);
        }
    };

    const handlePathChange = (value: string) => {
        onChange({
            ...settings,
            basePath: value,
        });
    };

    const handleScan = async () => {
        if (!settings.basePath) return;
        setScanning(true);
        try {
            await updateSettings({ basePath: settings.basePath });
            await scanProjects(settings.basePath);
            // Small delay to ensure DB is flushed
            await new Promise((resolve) => setTimeout(resolve, 100));
            window.location.reload();
        } finally {
            setScanning(false);
        }
    };

    return (
        <div className="bg-app-surface rounded-xl shadow-app-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-app-border">
                <h2 className="text-[13px] font-semibold text-app-text-main uppercase tracking-wide">
                    Workspace
                </h2>
            </div>
            <div className="px-4 py-3">
                <label className="block text-[14px] text-app-text-main mb-1.5">
                    Base Directory
                </label>
                <p className="text-[12px] text-app-text-muted mb-2">
                    Root folder containing your tracked projects
                </p>
                {isLinux ? (
                    <div className="flex flex-col gap-2">
                        <input
                            id="settings-base-path"
                            type="text"
                            value={settings.basePath || ""}
                            onChange={(e) => handlePathChange(e.target.value)}
                            placeholder="/home/username/projects or ~/projects"
                            className="w-full bg-app-bg border border-app-border rounded-lg px-3 py-2 text-[14px] text-app-text-main placeholder-app-text-muted focus:ring-2 focus:ring-app-accent/30 outline-none transition-all"
                        />
                        <button
                            type="button"
                            onClick={handleScan}
                            disabled={scanning || !settings.basePath}
                            className="flex items-center justify-center gap-2 bg-app-bg hover:bg-app-hover disabled:opacity-40 text-app-text-main border border-app-border rounded-lg px-3 py-2 text-[14px] transition-colors"
                        >
                            {scanning ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-app-text-main/30 border-t-app-text-main rounded-full animate-spin" />
                                    Scanning...
                                </>
                            ) : (
                                <>
                                    <RefreshCw size={16} />
                                    Scan for Projects
                                </>
                            )}
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <input
                            id="settings-base-path"
                            type="text"
                            value={settings.basePath || ""}
                            onChange={(e) =>
                                onChange({
                                    ...settings,
                                    basePath: e.target.value,
                                })
                            }
                            className="flex-1 bg-app-bg border border-app-border rounded-lg px-3 py-2 text-[14px] text-app-text-main placeholder-app-text-muted focus:ring-2 focus:ring-app-accent/30 outline-none transition-all"
                        />
                        <button
                            type="button"
                            onClick={handleBrowse}
                            className="flex items-center gap-1.5 bg-app-accent hover:bg-app-accent/80 text-white rounded-lg px-3 py-2 text-[14px] transition-colors"
                        >
                            <FolderOpen size={16} />
                            Browse
                        </button>
                        <button
                            type="button"
                            onClick={handleScan}
                            disabled={scanning || !settings.basePath}
                            className="flex items-center gap-1.5 bg-app-bg hover:bg-app-hover disabled:opacity-40 text-app-text-main border border-app-border rounded-lg px-3 py-2 text-[14px] transition-colors"
                        >
                            {scanning ? (
                                <div className="w-4 h-4 border-2 border-app-text-main/30 border-t-app-text-main rounded-full animate-spin" />
                            ) : (
                                <RefreshCw size={16} />
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
