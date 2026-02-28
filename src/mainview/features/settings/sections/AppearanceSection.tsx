interface AppearanceSectionProps {
    theme: "light" | "dark";
    onApplyTheme: (theme: "light" | "dark") => void;
}

export default function AppearanceSection({
    theme,
    onApplyTheme,
}: AppearanceSectionProps) {
    return (
        <div className="bg-mac-surface rounded-xl shadow-mac overflow-hidden">
            <div className="px-4 py-3 border-b border-mac-border">
                <h2 className="text-[13px] font-semibold text-mac-text uppercase tracking-wide">
                    Appearance
                </h2>
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-[14px] text-mac-text">Theme</span>
                <div className="flex bg-mac-bg rounded-lg p-0.5 gap-0.5">
                    <button
                        onClick={() => onApplyTheme("light")}
                        className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${
                            theme === "light"
                                ? "bg-mac-surface text-mac-text shadow-mac"
                                : "text-mac-secondary hover:text-mac-text"
                        }`}
                    >
                        Light
                    </button>
                    <button
                        onClick={() => onApplyTheme("dark")}
                        className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${
                            theme === "dark"
                                ? "bg-mac-surface text-mac-text shadow-mac"
                                : "text-mac-secondary hover:text-mac-text"
                        }`}
                    >
                        Dark
                    </button>
                </div>
            </div>
        </div>
    );
}
