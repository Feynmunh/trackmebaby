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

export default function TabBar<TTab extends string>({
    activeTab,
    onTabChange,
    tabs,
    settingsId,
}: TabBarProps<TTab>) {
    return (
        <nav className="flex flex-col w-[60px] bg-mac-sidebar backdrop-blur-xl h-full border-r border-mac-border items-center py-5 gap-1">
            {/* App icon */}
            <div className="w-9 h-9 rounded-[10px] bg-mac-accent text-white flex items-center justify-center font-semibold text-base mb-8 shadow-mac">
                T
            </div>

            {/* Main nav tabs */}
            <div className="flex-1 flex flex-col items-center gap-1">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            id={`tab-${tab.id}`}
                            onClick={() => onTabChange(tab.id)}
                            title={tab.label}
                            className={`
                                relative flex items-center justify-center w-10 h-10 rounded-[10px] transition-all duration-200
                                ${
                                    isActive
                                        ? "bg-mac-hover text-mac-text shadow-mac"
                                        : "text-mac-secondary hover:text-mac-text hover:bg-mac-hover"
                                }
                            `}
                        >
                            {/* Active indicator */}
                            {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-mac-accent rounded-r-full" />
                            )}
                            {tab.icon}
                        </button>
                    );
                })}
            </div>

            {/* Settings at bottom */}
            <div className="mt-auto">
                <button
                    id="tab-settings"
                    onClick={() => onTabChange(settingsId)}
                    title="Settings"
                    className={`
                        relative flex items-center justify-center w-10 h-10 rounded-[10px] transition-all duration-200
                        ${
                            activeTab === settingsId
                                ? "bg-mac-hover text-mac-text shadow-mac"
                                : "text-mac-secondary hover:text-mac-text hover:bg-mac-hover"
                        }
                    `}
                >
                    {activeTab === settingsId && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-mac-accent rounded-r-full" />
                    )}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-[20px] h-[20px]"
                    >
                        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                        <circle cx="12" cy="12" r="3" />
                    </svg>
                </button>
            </div>
        </nav>
    );
}
