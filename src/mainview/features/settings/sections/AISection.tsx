import {
    AlertTriangle,
    Brain,
    CheckCircle2,
    Eye,
    EyeOff,
    Info,
    KeyRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AISettingsStatus, Settings } from "../../../../shared/types.ts";
import ConfirmationModal from "../../../components/ui/ConfirmationModal.tsx";
import { getAISettingsStatus, setAIKey } from "../../../rpc.ts";

interface AISectionProps {
    settings: Settings;
    onChange: (settings: Settings) => void;
}

const MODEL_BY_PROVIDER: Record<string, string[]> = {
    groq: [
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
    ],
    gemini: [
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-3.1-pro-preview",
        "gemini-3.1-flash-lite-preview",
        "gemini-3-flash-preview",
    ],
};

const PROVIDERS = ["groq", "gemini"];

function providerLabel(provider: string): string {
    switch (provider) {
        case "groq":
            return "Groq";
        case "gemini":
            return "Google Gemini";
        default:
            return provider;
    }
}

export default function AISection({ settings, onChange }: AISectionProps) {
    const [apiKeyInput, setApiKeyInput] = useState("");
    const [showApiKey, setShowApiKey] = useState(false);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<AISettingsStatus | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

    // Local state for editing so we don't save to backend while browsing
    const [localProvider, setLocalProvider] = useState(settings.aiProvider);
    const [localModel, setLocalModel] = useState(settings.aiModel);

    const modelOptions = useMemo(() => {
        return MODEL_BY_PROVIDER[localProvider] || MODEL_BY_PROVIDER.groq;
    }, [localProvider]);

    const resolvedStatus = useMemo(() => {
        if (!status) {
            return {
                validationStatus: "idle" as const,
                hasKey: false,
                storageMode: "none" as const,
                keychainAvailable: true,
            };
        }
        return {
            validationStatus: status.validationStatus,
            hasKey: status.hasKey,
            storageMode: status.storageMode,
            keychainAvailable: status.keychainAvailable,
        };
    }, [status]);

    useEffect(() => {
        loadStatus();
    }, []);

    // Sync local state when entering edit mode or when props change
    useEffect(() => {
        if (!editMode) {
            setLocalProvider(settings.aiProvider);
            setLocalModel(settings.aiModel);
        }
    }, [editMode, settings.aiProvider, settings.aiModel]);

    // Ensure local model is valid for local provider
    useEffect(() => {
        if (!modelOptions.includes(localModel)) {
            setLocalModel(modelOptions[0]);
        }
    }, [modelOptions, localModel]);

    async function loadStatus() {
        try {
            const aiStatus = await getAISettingsStatus();
            setStatus(aiStatus);
            setStatusMessage(aiStatus.message);
        } catch {
            setStatusMessage(
                "Could not load AI settings status. You can still save a key.",
            );
        }
    }

    async function handleSaveAndVerify() {
        if (!apiKeyInput.trim()) {
            setStatusMessage("Please paste an API key first.");
            return;
        }

        setSaving(true);
        setStatusMessage("Validating connection...");

        try {
            const result = await setAIKey({
                provider: localProvider,
                model: localModel,
                apiKey: apiKeyInput,
                validate: true,
            });

            if (result.keySaved) {
                onChange({
                    ...settings,
                    aiProvider: localProvider,
                    aiModel: localModel,
                });
                setApiKeyInput("");
                setEditMode(false);
            }

            setStatusMessage(result.message);
            setStatus({
                provider: localProvider,
                model: localModel,
                hasKey: result.keySaved,
                storageMode: result.storageMode,
                keychainAvailable: result.keychainAvailable,
                validationStatus: result.validationStatus,
                message: result.message,
            });
        } catch (err: unknown) {
            setStatusMessage("Failed to save. Please try again.");
            console.error("AI Save error:", err);
        } finally {
            setSaving(false);
        }
    }

    async function handleRemove() {
        setShowRemoveConfirm(false);
        setSaving(true);
        try {
            const result = await setAIKey({
                provider: settings.aiProvider,
                apiKey: "",
                validate: false,
            });
            setStatus({
                provider: settings.aiProvider,
                model: settings.aiModel,
                hasKey: false,
                storageMode: result.storageMode,
                keychainAvailable: result.keychainAvailable,
                validationStatus: result.validationStatus,
                message: result.message,
            });
            setEditMode(false);
            setStatusMessage(result.message);
        } catch (err: unknown) {
            setStatusMessage("Failed to remove. Please try again.");
            console.error("AI Remove error:", err);
        } finally {
            setSaving(false);
        }
    }

    function handleCancelEdit() {
        setApiKeyInput("");
        setEditMode(false);
        setLocalProvider(settings.aiProvider);
        setLocalModel(settings.aiModel);
    }

    return (
        <div className="bg-app-surface rounded-xl shadow-app-sm">
            <ConfirmationModal
                isOpen={showRemoveConfirm}
                title="Remove AI Configuration"
                message="Are you sure you want to remove your AI configuration? This will delete your API key from this device."
                confirmLabel="Remove"
                onConfirm={handleRemove}
                onCancel={() => setShowRemoveConfirm(false)}
                isDangerous
            />
            <div className="px-4 py-3 border-b border-app-border">
                <h2 className="text-[13px] font-semibold text-app-text-main uppercase tracking-wide">
                    AI
                </h2>
            </div>

            <div className="px-4 py-4">
                {resolvedStatus.hasKey && !editMode ? (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-app-bg text-app-text-muted">
                                    <Brain className="w-5 h-5" />
                                </div>
                                <div>
                                    <span className="text-[14px] text-app-text-main font-medium">
                                        {providerLabel(settings.aiProvider)}
                                    </span>
                                    <p className="text-[12px] text-app-text-muted">
                                        {settings.aiModel}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setEditMode(true)}
                                    className="px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all active:scale-[0.98] bg-app-bg hover:bg-app-hover text-app-text-main"
                                >
                                    Change
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowRemoveConfirm(true)}
                                    disabled={saving}
                                    className="px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all active:scale-[0.98] bg-app-bg hover:bg-red-500/10 hover:text-red-400 text-app-text-muted"
                                >
                                    Remove
                                </button>
                            </div>
                        </div>

                        {resolvedStatus.storageMode === "local_unencrypted" && (
                            <div className="flex items-start gap-2.5 rounded-lg border border-app-warning/30 bg-app-warning/10 px-3 py-2.5">
                                <AlertTriangle className="w-4 h-4 mt-0.5 text-app-warning" />
                                <p className="text-[12px] text-app-text-main leading-relaxed">
                                    Secure OS keychain is unavailable. Your key
                                    is stored in this app&apos;s local SQLite
                                    database in plain text. It stays local to
                                    your machine unless you share device files
                                    or backups.
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <div className="block text-[14px] text-app-text-main">
                                Provider
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {PROVIDERS.map((provider) => {
                                    const isActive = localProvider === provider;
                                    return (
                                        <button
                                            key={provider}
                                            type="button"
                                            onClick={() =>
                                                setLocalProvider(provider)
                                            }
                                            className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                                                isActive
                                                    ? "border-app-accent bg-app-accent/10 text-app-accent"
                                                    : "border-app-border bg-app-bg text-app-text-main hover:bg-app-hover"
                                            }`}
                                        >
                                            <span className="block text-[13px] font-medium">
                                                {providerLabel(provider)}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="block text-[14px] text-app-text-main">
                                Model
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {modelOptions.map((model) => {
                                    const isActive = localModel === model;
                                    return (
                                        <button
                                            key={model}
                                            type="button"
                                            onClick={() => setLocalModel(model)}
                                            className={`rounded-lg border px-3 py-1.5 text-[12px] transition-colors ${
                                                isActive
                                                    ? "border-app-accent bg-app-accent/10 text-app-accent"
                                                    : "border-app-border bg-app-bg text-app-text-main hover:bg-app-hover"
                                            }`}
                                        >
                                            {model}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label
                                htmlFor="settings-ai-key"
                                className="block text-[14px] text-app-text-main"
                            >
                                API Key ({providerLabel(localProvider)})
                            </label>
                            <div className="flex items-center gap-2 bg-app-bg border border-app-border rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-app-accent/30 transition-all">
                                <KeyRound className="w-4 h-4 text-app-text-muted" />
                                <input
                                    id="settings-ai-key"
                                    type={showApiKey ? "text" : "password"}
                                    value={apiKeyInput}
                                    onChange={(e) =>
                                        setApiKeyInput(e.target.value)
                                    }
                                    placeholder={`Paste your ${providerLabel(localProvider)} key`}
                                    className="flex-1 bg-transparent text-[14px] text-app-text-main placeholder-app-text-muted outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowApiKey((prev) => !prev)
                                    }
                                    className="text-app-text-muted hover:text-app-text-main transition-colors"
                                    title={showApiKey ? "Hide key" : "Show key"}
                                >
                                    {showApiKey ? (
                                        <EyeOff className="w-4 h-4" />
                                    ) : (
                                        <Eye className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                            <p className="text-[12px] text-app-text-muted flex items-center gap-1.5">
                                <Info className="w-3.5 h-3.5" />
                                Local only. We never receive your key.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={handleSaveAndVerify}
                                disabled={saving || !apiKeyInput.trim()}
                                className="px-4 py-2 rounded-lg text-[13px] font-medium bg-app-accent hover:bg-app-accent/85 text-white disabled:opacity-40 transition-colors"
                            >
                                {saving ? "Saving..." : "Save & Verify"}
                            </button>
                            {editMode && (
                                <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    disabled={saving}
                                    className="px-4 py-2 rounded-lg text-[13px] font-medium bg-app-bg hover:bg-app-hover text-app-text-main border border-app-border disabled:opacity-40 transition-colors"
                                >
                                    Cancel
                                </button>
                            )}
                        </div>

                        {resolvedStatus.storageMode === "local_unencrypted" && (
                            <div className="flex items-start gap-2.5 rounded-lg border border-app-warning/30 bg-app-warning/10 px-3 py-2.5">
                                <AlertTriangle className="w-4 h-4 mt-0.5 text-app-warning" />
                                <p className="text-[12px] text-app-text-main leading-relaxed">
                                    Secure OS keychain is unavailable. Your key
                                    is stored in this app&apos;s local SQLite
                                    database in plain text. It stays local to
                                    your machine unless you share device files
                                    or backups.
                                </p>
                            </div>
                        )}

                        {statusMessage && (
                            <p className="text-[12px] text-app-text-muted flex items-start gap-2">
                                {resolvedStatus.validationStatus === "valid" ? (
                                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-app-success" />
                                ) : null}
                                <span>{statusMessage}</span>
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
