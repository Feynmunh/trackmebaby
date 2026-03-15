import { homedir } from "node:os";
import { Utils } from "electrobun/bun";
import {
    DEFAULT_AI_MODEL_BY_PROVIDER,
    normalizeAIModel,
} from "../../../../shared/ai-models.ts";
import { toErrorData } from "../../../../shared/error.ts";
import { createLogger } from "../../../../shared/logger.ts";
import type {
    AISettingsStatus,
    SetAIKeyResult,
    Settings,
} from "../../../../shared/types.ts";
import {
    type AIProvider,
    type AISecretStore,
    resolveAIProvider,
} from "../../../services/ai/index.ts";
import type { ProjectScanner } from "../../../services/project-scanner.ts";
import type { SettingsService } from "../../../services/settings.ts";

export interface SettingsHandlersDeps {
    settingsService: SettingsService;
    scanner: ProjectScanner;
    aiSecretStore: AISecretStore;
    getAIProvider: () => Promise<AIProvider>;
    resetAIProvider: () => void;
}

const logger = createLogger("rpc-settings");

const INVALID_PROVIDER_MESSAGE =
    "Unsupported AI provider. Supported providers are: groq, gemini.";

export function createSettingsHandlers({
    settingsService,
    scanner,
    aiSecretStore,
    getAIProvider,
    resetAIProvider,
}: SettingsHandlersDeps) {
    return {
        getSettings: () => {
            return settingsService.getAll();
        },
        updateSettings: ({ settings }: { settings: Partial<Settings> }) => {
            if (settings.aiProvider !== undefined) {
                try {
                    resolveAIProvider(settings.aiProvider);
                } catch {
                    throw new Error(INVALID_PROVIDER_MESSAGE);
                }
            }

            const current = settingsService.getAll();

            const aiSettingsChanged =
                (settings.aiProvider !== undefined &&
                    settings.aiProvider !== current.aiProvider) ||
                (settings.aiModel !== undefined &&
                    settings.aiModel !== current.aiModel);

            settingsService.updateMany(settings);
            if (aiSettingsChanged) {
                resetAIProvider();
            }
            return { success: true };
        },
        getAISettingsStatus: async (): Promise<AISettingsStatus> => {
            const settings = settingsService.getAll();
            const provider = settings.aiProvider;
            const model = normalizeAIModel(provider, settings.aiModel);
            const hasKey = await aiSecretStore.hasApiKey(provider);
            const storageMode = await aiSecretStore.getStorageMode(provider);
            const keychainAvailable = await aiSecretStore.isKeychainAvailable();

            let message: string | null = null;
            if (storageMode === "local_unencrypted") {
                message =
                    "Secure OS keychain is unavailable. Your API key is saved only on this device in the app database (unencrypted).";
            }

            return {
                provider,
                model,
                hasKey,
                storageMode,
                keychainAvailable,
                validationStatus: "idle",
                message,
            };
        },
        setAIKey: async ({
            provider,
            apiKey,
            model,
            validate,
        }: {
            provider: string;
            apiKey: string;
            model?: string;
            validate?: boolean;
        }): Promise<SetAIKeyResult> => {
            let normalizedProvider: Settings["aiProvider"];
            try {
                normalizedProvider = resolveAIProvider(provider);
            } catch {
                return {
                    keySaved: false,
                    storageMode: "none",
                    keychainAvailable:
                        await aiSecretStore.isKeychainAvailable(),
                    validationStatus: "error",
                    message: INVALID_PROVIDER_MESSAGE,
                };
            }
            const normalizedModel = normalizeAIModel(
                normalizedProvider,
                model ?? DEFAULT_AI_MODEL_BY_PROVIDER[normalizedProvider],
            );

            // Handle removal (empty key)
            if (!apiKey.trim()) {
                await aiSecretStore.clearApiKey(normalizedProvider);
                settingsService.updateMany({
                    aiProvider: normalizedProvider,
                    aiModel: normalizedModel,
                });
                resetAIProvider();
                const keychainAvailable =
                    await aiSecretStore.isKeychainAvailable();
                return {
                    keySaved: false,
                    storageMode: "none",
                    keychainAvailable,
                    validationStatus: "idle",
                    message: "AI configuration removed.",
                };
            }

            settingsService.updateMany({
                aiProvider: normalizedProvider,
                aiModel: normalizedModel,
            });

            const setResult = await aiSecretStore.setApiKey(
                normalizedProvider,
                apiKey,
            );
            resetAIProvider();

            if (validate === false) {
                return {
                    keySaved: true,
                    storageMode: setResult.storageMode,
                    keychainAvailable: setResult.keychainAvailable,
                    validationStatus: "skipped",
                    message:
                        setResult.storageMode === "secure"
                            ? "API key saved securely in your OS keychain."
                            : "API key saved locally in the app database (unencrypted).",
                };
            }

            let connected = false;
            try {
                const providerInstance = await getAIProvider();
                connected = await providerInstance.testConnection();
            } catch (err: unknown) {
                logger.warn("ai key validation failed", {
                    error: toErrorData(err),
                    provider: normalizedProvider,
                });
                connected = false;
            }

            if (connected) {
                return {
                    keySaved: true,
                    storageMode: setResult.storageMode,
                    keychainAvailable: setResult.keychainAvailable,
                    validationStatus: "valid",
                    message:
                        setResult.storageMode === "secure"
                            ? "Connection successful. API key saved securely in your OS keychain."
                            : "Connection successful. API key saved locally in the app database (unencrypted).",
                };
            }

            return {
                keySaved: true,
                storageMode: setResult.storageMode,
                keychainAvailable: setResult.keychainAvailable,
                validationStatus: "invalid",
                message:
                    "API key saved. Could not validate connection. Please check the key and provider, then try again.",
            };
        },
        scanProjects: async ({ basePath }: { basePath: string }) => {
            // Expand ~ to home directory
            let expandedPath = basePath;
            if (basePath.startsWith("~/")) {
                expandedPath = `${homedir()}/${basePath.slice(2)}`;
            }
            const projects = await scanner.scan(expandedPath);
            settingsService.setBasePath(expandedPath);
            return projects;
        },
        selectFolder: async ({ defaultPath }: { defaultPath?: string }) => {
            try {
                console.log(
                    "[selectFolder] Opening dialog, starting folder:",
                    defaultPath,
                );
                // biome-ignore lint/suspicious/noExplicitAny: Electrobun Utils type definition is incomplete
                const filePaths = await (Utils as any).openFileDialog({
                    startingFolder: defaultPath || "/home",
                    canChooseDirectory: true,
                });
                console.log("[selectFolder] Dialog returned:", filePaths);
                if (!filePaths || filePaths.length === 0) {
                    console.log("[selectFolder] No folder selected");
                    return null;
                }
                console.log("[selectFolder] Selected folder:", filePaths[0]);
                return filePaths[0];
            } catch (err) {
                console.error("[selectFolder] Error:", err);
                return null;
            }
        },
    };
}
