interface AppearanceSectionProps {
    theme: "light" | "dark" | "system";
    onApplyTheme: (theme: "light" | "dark" | "system") => void;
}

export default function AppearanceSection({
    theme,
    onApplyTheme,
}: AppearanceSectionProps) {
    return (
        <div className="bg-app-surface rounded-xl shadow-app-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-app-border">
                <h2 className="text-[13px] font-semibold text-app-text-main uppercase tracking-wide">
                    Appearance
                </h2>
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-[14px] text-app-text-main">Theme</span>
                <div className="flex bg-app-bg rounded-lg p-0.5 gap-0.5">
                    <button
                        onClick={() => onApplyTheme("system")}
                        className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${
                            theme === "system"
                                ? "bg-app-surface text-app-text-main shadow-app-sm"
                                : "text-app-text-muted hover:text-app-text-main"
                        }`}
                    >
                        System
                    </button>
                    <button
                        onClick={() => onApplyTheme("light")}
                        className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${
                            theme === "light"
                                ? "bg-app-surface text-app-text-main shadow-app-sm"
                                : "text-app-text-muted hover:text-app-text-main"
                        }`}
                    >
                        Light
                    </button>
                    <button
                        onClick={() => onApplyTheme("dark")}
                        className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${
                            theme === "dark"
                                ? "bg-app-surface text-app-text-main shadow-app-sm"
                                : "text-app-text-muted hover:text-app-text-main"
                        }`}
                    >
                        Dark
                    </button>
                </div>
            </div>
        </div>
    );
}
