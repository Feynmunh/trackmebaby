import { homedir } from "node:os";
import { Utils } from "electrobun/bun";
import { toErrorData } from "../../../../shared/error.ts";
import { createLogger } from "../../../../shared/logger.ts";
import type {
    AISettingsStatus,
    SetAIKeyResult,
    Settings,
} from "../../../../shared/types.ts";
import type { AIProvider, AISecretStore } from "../../../services/ai/index.ts";
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
            const aiSettingsChanged =
                settings.aiProvider !== undefined ||
                settings.aiModel !== undefined;
            settingsService.updateMany(settings);
            if (aiSettingsChanged) {
                resetAIProvider();
            }
            return { success: true };
        },
        getAISettingsStatus: async (): Promise<AISettingsStatus> => {
            const settings = settingsService.getAll();
            const hasKey = await aiSecretStore.hasApiKey(settings.aiProvider);
            const storageMode = await aiSecretStore.getStorageMode(
                settings.aiProvider,
            );
            const keychainAvailable = await aiSecretStore.isKeychainAvailable();

            return {
                provider: settings.aiProvider,
                model: settings.aiModel,
                hasKey,
                storageMode,
                keychainAvailable,
                validationStatus: "idle",
                message:
                    storageMode === "local_unencrypted"
                        ? "Secure OS keychain is unavailable. Your API key is saved only on this device in the app database (unencrypted)."
                        : null,
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
            // Handle removal (empty key with validate === false)
            if (!apiKey.trim() && validate === false) {
                await aiSecretStore.clearApiKey(provider);
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

            if (!apiKey.trim()) {
                return {
                    keySaved: false,
                    storageMode: "none",
                    keychainAvailable:
                        await aiSecretStore.isKeychainAvailable(),
                    validationStatus: "invalid",
                    message: "API key cannot be empty.",
                };
            }

            settingsService.updateMany({
                aiProvider: provider,
                ...(model ? { aiModel: model } : {}),
            });

            const setResult = await aiSecretStore.setApiKey(provider, apiKey);
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
                    provider,
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
        validateAIKey: async ({
            provider,
            model,
        }: {
            provider?: string;
            model?: string;
        }) => {
            if (provider || model) {
                settingsService.updateMany({
                    ...(provider ? { aiProvider: provider } : {}),
                    ...(model ? { aiModel: model } : {}),
                });
                resetAIProvider();
            }

            try {
                const currentSettings = settingsService.getAll();
                const hasKey = await aiSecretStore.hasApiKey(
                    currentSettings.aiProvider,
                );
                if (!hasKey) {
                    return {
                        success: false,
                        validationStatus: "invalid" as const,
                        message: "No API key found for the selected provider.",
                    };
                }

                const providerInstance = await getAIProvider();
                const connected = await providerInstance.testConnection();
                return connected
                    ? {
                          success: true,
                          validationStatus: "valid" as const,
                          message: "Connection successful.",
                      }
                    : {
                          success: false,
                          validationStatus: "invalid" as const,
                          message:
                              "Could not validate this API key. Please check credentials and network.",
                      };
            } catch {
                return {
                    success: false,
                    validationStatus: "error" as const,
                    message: "Validation failed due to an unexpected error.",
                };
            }
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
