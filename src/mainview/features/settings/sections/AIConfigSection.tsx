import type { Settings } from "../../../../shared/types.ts";

interface AIConfigSectionProps {
    settings: Settings;
    apiKey: string;
    onSettingsChange: (settings: Settings) => void;
    onApiKeyChange: (value: string) => void;
}

export default function AIConfigSection({
    settings,
    apiKey,
    onSettingsChange,
    onApiKeyChange,
}: AIConfigSectionProps) {
    return (
        <div className="bg-mac-surface rounded-xl shadow-mac overflow-hidden">
            <div className="px-4 py-3 border-b border-mac-border">
                <h2 className="text-[13px] font-semibold text-mac-text uppercase tracking-wide">
                    AI Configuration
                </h2>
            </div>
            <div className="divide-y divide-mac-border">
                <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-[14px] text-mac-text">Provider</span>
                    <select
                        id="settings-ai-provider"
                        value={settings.aiProvider}
                        onChange={(e) =>
                            onSettingsChange({
                                ...settings,
                                aiProvider: e.target.value,
                            })
                        }
                        className="bg-mac-bg rounded-lg px-3 py-1.5 text-[14px] text-mac-text focus:ring-2 focus:ring-mac-accent/30 outline-none appearance-none pr-8"
                    >
                        <option value="groq">Groq (Free Tier)</option>
                        <option value="openai">OpenAI</option>
                    </select>
                </div>
                <div className="px-4 py-3 flex items-center justify-between gap-4">
                    <span className="text-[14px] text-mac-text shrink-0">
                        Model
                    </span>
                    <input
                        id="settings-model"
                        type="text"
                        value={settings.aiModel}
                        onChange={(e) =>
                            onSettingsChange({
                                ...settings,
                                aiModel: e.target.value,
                            })
                        }
                        placeholder="llama-3.3-70b-versatile"
                        className="bg-mac-bg rounded-lg px-3 py-1.5 text-[14px] text-mac-text text-right placeholder-mac-secondary focus:ring-2 focus:ring-mac-accent/30 outline-none w-64"
                    />
                </div>
                <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[14px] text-mac-text">
                            API Key
                        </span>
                    </div>
                    <p className="text-[12px] text-mac-secondary mb-2">
                        Set via{" "}
                        <code className="bg-mac-bg px-1.5 py-0.5 rounded text-[11px]">
                            GROQ_API_KEY
                        </code>{" "}
                        env var, or enter below
                    </p>
                    <input
                        id="settings-api-key"
                        type="password"
                        value={apiKey}
                        onChange={(e) => onApiKeyChange(e.target.value)}
                        placeholder="Enter API key"
                        className="w-full bg-mac-bg rounded-lg px-3 py-2 text-[14px] text-mac-text placeholder-mac-secondary focus:ring-2 focus:ring-mac-accent/30 outline-none"
                    />
                </div>
            </div>
        </div>
    );
}
