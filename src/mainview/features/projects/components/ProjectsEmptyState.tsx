import { FolderOpen } from "lucide-react";

interface ProjectsEmptyStateProps {
    isLinux: boolean;
    basePathInput: string;
    onBasePathChange: (value: string) => void;
    onSavePath: () => void;
    savingPath: boolean;
    selectingFolder: boolean;
    onSelectFolder: () => void;
}

export default function ProjectsEmptyState({
    isLinux,
    basePathInput,
    onBasePathChange,
    onSavePath,
    savingPath,
    selectingFolder,
    onSelectFolder,
}: ProjectsEmptyStateProps) {
    const basePathInputId = "projects-base-path-input";

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
                        <label htmlFor={basePathInputId} className="sr-only">
                            Projects folder path
                        </label>
                        <input
                            id={basePathInputId}
                            type="text"
                            value={basePathInput}
                            onChange={(e) => onBasePathChange(e.target.value)}
                            placeholder="/home/username/projects or ~/projects"
                            className="w-full bg-mac-bg border border-black/20 dark:border-white/10 rounded-lg px-3 py-2 text-[14px] text-mac-text placeholder-mac-secondary focus:ring-2 focus:ring-mac-accent/30 outline-none transition-all"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    onSavePath();
                                }
                            }}
                        />
                        <button
                            className="bg-mac-accent text-white font-medium px-5 py-2.5 rounded-lg hover:opacity-90 active:scale-[0.98] transition-all shadow-mac flex items-center justify-center gap-2 disabled:opacity-50"
                            onClick={onSavePath}
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
                        onClick={onSelectFolder}
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
