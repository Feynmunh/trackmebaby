import { FolderOpen } from "lucide-react";

interface ProjectsEmptyStateProps {
    selectingFolder: boolean;
    onSelectFolder: () => void;
}

export default function ProjectsEmptyState({
    selectingFolder,
    onSelectFolder,
}: ProjectsEmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="bg-app-surface rounded-2xl p-12 shadow-app-md flex flex-col items-center max-w-md">
                <div className="w-16 h-16 rounded-2xl bg-app-bg flex items-center justify-center mb-5">
                    <FolderOpen className="w-8 h-8 text-app-text-muted" />
                </div>
                <h2 className="text-xl font-semibold text-app-text-main mb-2">
                    Select your project folder
                </h2>
                <p className="text-app-text-muted text-sm mb-6 leading-relaxed">
                    Choose a folder containing your projects to start tracking
                    your work automatically.
                </p>
                <button
                    className="bg-app-accent text-white font-medium px-5 py-2.5 rounded-lg hover:opacity-90 active:scale-[0.98] transition-all shadow-app-sm flex items-center gap-2"
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
            </div>
        </div>
    );
}
