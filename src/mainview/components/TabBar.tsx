interface TabOption<TTab extends string> {
    id: TTab;
    label: string;
    icon: JSX.Element;
}

interface TabBarProps<TTab extends string> {
    activeTab: TTab;
    onTabChange: (tab: TTab) => void;
    tabs: ReadonlyArray<TabOption<TTab>>;
    settingsId: TTab;
}

/** Geometric mosaic logo — mirrors the reference image style */
function AppLogo() {
    const accent = "#e1510e";
    const accentFade = "#e1510e99";
    return (
        <svg
            viewBox="0 0 36 36"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-[38px] h-[38px]"
        >
            {/* Top-left filled block */}
            <rect x="2" y="2" width="14" height="14" rx="3" fill={accent} />
            {/* Top-right outlined inset block */}
            <rect
                x="20"
                y="2"
                width="14"
                height="14"
                rx="3"
                fill="none"
                stroke={accent}
                strokeWidth="2.2"
            />
            {/* Bottom-left: 2×2 mini grid */}
            <rect x="2" y="20" width="6" height="6" rx="1.5" fill={accent} />
            <rect
                x="10"
                y="20"
                width="6"
                height="6"
                rx="1.5"
                fill={accentFade}
            />
            <rect
                x="2"
                y="28"
                width="6"
                height="6"
                rx="1.5"
                fill={accentFade}
            />
            <rect x="10" y="28" width="6" height="6" rx="1.5" fill={accent} />
            {/* Bottom-right diagonal slash mark */}
            <line
                x1="21"
                y1="33"
                x2="33"
                y2="21"
                stroke={accent}
                strokeWidth="2.5"
                strokeLinecap="round"
            />
            <line
                x1="21"
                y1="26"
                x2="27"
                y2="20"
                stroke={accentFade}
                strokeWidth="2.5"
                strokeLinecap="round"
            />
        </svg>
    );
}

const SettingsIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-[20px] h-[20px]"
    >
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

interface NavButtonProps {
    buttonId: string;
    label: string;
    icon: JSX.Element;
    isActive: boolean;
    onClick: () => void;
}

function NavButton({
    buttonId,
    label,
    icon,
    isActive,
    onClick,
}: NavButtonProps) {
    return (
        <div className="relative group w-full flex items-center justify-center">
            <button
                id={`tab-${buttonId}`}
                onClick={onClick}
                className={[
                    "relative flex items-center justify-center w-12 h-12 rounded-2xl",
                    "transition-all duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-white/20",
                    isActive
                        ? "bg-app-surface text-app-text-main shadow-sm"
                        : "text-app-text-muted hover:text-app-text-main hover:bg-app-surface/50 active:scale-95",
                ].join(" ")}
            >
                {icon}
            </button>

            {/* Floating label tooltip */}
            <div
                aria-hidden
                className={[
                    "pointer-events-none absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 z-50",
                    "px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap",
                    "bg-app-surface-elevated border border-app-border text-app-text-main shadow-xl",
                    "opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0",
                    "transition-all duration-150 ease-out",
                ].join(" ")}
            >
                {label}
            </div>
        </div>
    );
}

export default function TabBar<TTab extends string>({
    activeTab,
    onTabChange,
    tabs,
    settingsId,
}: TabBarProps<TTab>) {
    return (
        <nav className="flex flex-col w-[72px] h-full items-center py-5 gap-0 select-none shrink-0 bg-app-surface-elevated border-r border-app-border">
            {/* Logo mark */}
            <div className="flex items-center justify-center w-12 h-12 mb-8 shrink-0">
                <AppLogo />
            </div>

            {/* Main nav */}
            <div className="flex flex-col items-center gap-2 flex-1 w-full px-3">
                {tabs.map((tab) => (
                    <NavButton
                        key={tab.id}
                        buttonId={tab.id as string}
                        label={tab.label}
                        icon={tab.icon}
                        isActive={activeTab === tab.id}
                        onClick={() => onTabChange(tab.id)}
                    />
                ))}
            </div>

            {/* Settings pinned at bottom */}
            <div className="mt-auto w-full px-3 shrink-0">
                <NavButton
                    buttonId="settings"
                    label="Settings"
                    icon={<SettingsIcon />}
                    isActive={activeTab === settingsId}
                    onClick={() => onTabChange(settingsId)}
                />
            </div>
        </nav>
    );
}
