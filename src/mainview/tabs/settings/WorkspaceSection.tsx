import type { Settings } from "../../../shared/types.ts";

interface WorkspaceSectionProps {
    settings: Settings;
    onChange: (settings: Settings) => void;
}

export default function WorkspaceSection({
    settings,
    onChange,
}: WorkspaceSectionProps) {
    return (
        <div className="bg-mac-surface rounded-xl shadow-mac overflow-hidden">
            <div className="px-4 py-3 border-b border-mac-border">
                <h2 className="text-[13px] font-semibold text-mac-text uppercase tracking-wide">
                    Workspace
                </h2>
            </div>
            <div className="px-4 py-3">
                <label className="block text-[14px] text-mac-text mb-1.5">
                    Base Directory
                </label>
                <p className="text-[12px] text-mac-secondary mb-2">
                    Root folder containing your tracked projects
                </p>
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
                    placeholder="/home/user/projects"
                    className="w-full bg-mac-bg rounded-lg px-3 py-2 text-[14px] text-mac-text placeholder-mac-secondary focus:ring-2 focus:ring-mac-accent/30 outline-none transition-all"
                />
            </div>
        </div>
    );
}
