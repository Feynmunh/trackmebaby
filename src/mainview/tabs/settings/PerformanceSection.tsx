import type { Settings } from "../../../shared/types.ts";

interface PerformanceSectionProps {
    settings: Settings;
    onChange: (settings: Settings) => void;
}

export default function PerformanceSection({
    settings,
    onChange,
}: PerformanceSectionProps) {
    return (
        <div className="bg-mac-surface rounded-xl shadow-mac overflow-hidden">
            <div className="px-4 py-3 border-b border-mac-border">
                <h2 className="text-[13px] font-semibold text-mac-text uppercase tracking-wide">
                    Performance
                </h2>
            </div>
            <div className="divide-y divide-mac-border">
                <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-[14px] text-mac-text">
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
                        className="bg-mac-bg rounded-lg px-3 py-1.5 text-[14px] text-mac-text text-right focus:ring-2 focus:ring-mac-accent/30 outline-none w-24"
                    />
                </div>
                <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-[14px] text-mac-text">
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
                        className="bg-mac-bg rounded-lg px-3 py-1.5 text-[14px] text-mac-text text-right focus:ring-2 focus:ring-mac-accent/30 outline-none w-24"
                    />
                </div>
            </div>
        </div>
    );
}
