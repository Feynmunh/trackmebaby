import type { Settings } from "../../../../shared/types.ts";

interface PerformanceSectionProps {
    settings: Settings;
    onChange: (settings: Settings) => void;
}

export default function PerformanceSection({
    settings,
    onChange,
}: PerformanceSectionProps) {
    return (
        <div className="bg-app-surface rounded-xl shadow-app-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-app-border">
                <h2 className="text-[13px] font-semibold text-app-text-main uppercase tracking-wide">
                    Performance
                </h2>
            </div>
            <div className="divide-y divide-app-border">
                <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-[14px] text-app-text-main">
                        Git Poll Interval (s)
                    </span>
                    <input
                        id="settings-poll-interval"
                        type="number"
                        value={settings.pollInterval / 1000}
                        onChange={(e) =>
                            onChange({
                                ...settings,
                                pollInterval:
                                    parseInt(e.target.value, 10) * 1000,
                            })
                        }
                        min={30}
                        className="bg-app-bg rounded-lg px-3 py-1.5 text-[14px] text-app-text-main text-right focus:ring-2 focus:ring-app-accent/30 outline-none w-24"
                    />
                </div>
                <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-[14px] text-app-text-main">
                        File Watcher Debounce (ms)
                    </span>
                    <input
                        id="settings-debounce"
                        type="number"
                        value={settings.watchDebounce}
                        onChange={(e) =>
                            onChange({
                                ...settings,
                                watchDebounce: parseInt(e.target.value, 10),
                            })
                        }
                        min={100}
                        className="bg-app-bg rounded-lg px-3 py-1.5 text-[14px] text-app-text-main text-right focus:ring-2 focus:ring-app-accent/30 outline-none w-24"
                    />
                </div>
            </div>
        </div>
    );
}
