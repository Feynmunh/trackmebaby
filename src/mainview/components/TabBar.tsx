import { Settings2 } from "lucide-react";

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

const SettingsIcon = () => (
    <Settings2 className="w-[19px] h-[19px]" strokeWidth={2.2} />
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
                    "relative flex items-center justify-center w-11 h-11 rounded-2xl border",
                    "transition-all duration-200 ease-out outline-none focus-visible:ring-2 focus-visible:ring-app-accent/40",
                    isActive
                        ? "bg-app-surface-elevated text-app-accent border-app-accent/35"
                        : "bg-transparent text-app-text-muted border-transparent hover:text-app-text-main hover:bg-app-surface/45 hover:border-app-border/80 active:scale-95",
                ].join(" ")}
            >
                <span className="flex items-center justify-center">{icon}</span>
                <span
                    aria-hidden
                    className={[
                        "absolute -right-[9px] top-1/2 -translate-y-1/2 w-[4px] h-[18px] rounded-full transition-all duration-200",
                        isActive
                            ? "bg-app-accent opacity-100"
                            : "bg-app-border opacity-0 group-hover:opacity-60",
                    ].join(" ")}
                />
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
        <nav className="flex flex-col w-[80px] h-full items-center py-5 gap-4 select-none shrink-0 bg-app-surface/40 backdrop-blur-xl border-r border-app-border/40 text-sm font-medium z-50">
            {/* Minimal App Brand Element (Optional Top Decorator) */}
            <div className="w-10 h-1 rounded-full bg-gradient-to-r from-transparent via-app-border to-transparent mt-1 opacity-60" />

            {/* Main nav */}
            <div className="flex flex-col items-center gap-2 flex-1 w-full px-3 py-2 mt-4">
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
            <div className="mt-auto w-full px-3 pb-3 shrink-0 flex flex-col items-center">
                <div className="w-6 h-px bg-app-border/40 my-3" />
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
