import type { ReactNode } from "react";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import { toErrorData } from "../../shared/error.ts";
import { createLogger } from "../../shared/logger.ts";
import GitHubDeviceFlowModal from "../features/github/GitHubDeviceFlowModal.tsx";
import {
    getGitHubAuthStatus,
    githubPollDeviceFlow,
    githubSignOut,
    githubStartDeviceFlow,
} from "../rpc";

const logger = createLogger("github-auth");

interface GitHubAuthContextType {
    isAuthenticated: boolean;
    username: string | null;
    loading: boolean;
    error: string | null;
    signIn: () => Promise<void>;
    signOut: () => Promise<void>;
    clearError: () => void;
}

const GitHubAuthContext = createContext<GitHubAuthContextType | undefined>(
    undefined,
);

export function GitHubAuthProvider({ children }: { children: ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [username, setUsername] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [deviceFlowActive, setDeviceFlowActive] = useState(false);
    const [userCode, setUserCode] = useState("");
    const [verificationUri, setVerificationUri] = useState("");
    const [verificationUriComplete, setVerificationUriComplete] = useState<
        string | null
    >(null);
    const pollTimeoutRef = useRef<Timer | null>(null);
    const activeFlowRef = useRef(false);
    const signInGuardRef = useRef(false);

    const clearPollTimer = useCallback(() => {
        if (pollTimeoutRef.current) {
            clearTimeout(pollTimeoutRef.current);
            pollTimeoutRef.current = null;
        }
    }, []);

    const cancelDeviceFlowInternal = useCallback(() => {
        clearPollTimer();
        activeFlowRef.current = false;
        setDeviceFlowActive(false);
        setLoading(false);
    }, [clearPollTimer]);

    const terminateFlow = useCallback(
        (errorMsg?: string) => {
            activeFlowRef.current = false;
            signInGuardRef.current = false;
            clearPollTimer();
            if (errorMsg) {
                setError(errorMsg);
            }
            setLoading(false);
            setDeviceFlowActive(false);
        },
        [clearPollTimer],
    );

    const checkAuthStatus = useCallback(async () => {
        try {
            const status = await getGitHubAuthStatus();
            setIsAuthenticated(status.authenticated);
            setUsername(status.username ?? null);
        } catch (err) {
            logger.warn("Failed to check auth status", {
                error: toErrorData(err),
            });
        }
    }, []);

    useEffect(() => {
        checkAuthStatus();
        return () => {
            clearPollTimer();
            activeFlowRef.current = false;
        };
    }, [checkAuthStatus, clearPollTimer]);

    const signIn = useCallback(async () => {
        if (loading || signInGuardRef.current) return;
        signInGuardRef.current = true;
        setError(null);
        clearPollTimer();
        activeFlowRef.current = true;
        setLoading(true);

        try {
            const result = await githubStartDeviceFlow();
            if (
                !result.success ||
                !result.deviceCode ||
                !result.userCode ||
                !result.verificationUri
            ) {
                terminateFlow(result.error || "Failed to start sign-in");
                return;
            }

            setUserCode(result.userCode);
            setVerificationUri(result.verificationUri);
            setVerificationUriComplete(result.verificationUriComplete || null);
            setDeviceFlowActive(true);

            const startTime = Date.now();
            const hardExpiryMs = (result.expiresIn || 900) * 1000;
            const baseDelayMs = Math.max((result.interval || 5) * 1000, 1000);
            const maxTransientFailures = 12;
            let transientFailures = 0;
            let slowDownCount = 0;
            let currentIntervalMs = baseDelayMs;

            const scheduleNextPoll = (delayMs: number) => {
                if (!activeFlowRef.current) return;

                if (Date.now() - startTime > hardExpiryMs) {
                    terminateFlow(
                        "Authorization code expired. Please try again.",
                    );
                    return;
                }

                clearPollTimer();
                pollTimeoutRef.current = setTimeout(() => {
                    void poll();
                }, delayMs);
            };

            const jitterDelay = (delayMs: number): number => {
                const jitter = Math.floor(Math.random() * 250);
                return delayMs + jitter;
            };

            const poll = async () => {
                if (!activeFlowRef.current) return;
                try {
                    const pollResult = await githubPollDeviceFlow(
                        result.deviceCode!,
                    );
                    if (pollResult.success) {
                        terminateFlow();
                        await checkAuthStatus();
                        return;
                    }

                    if (pollResult.error === "pending") {
                        transientFailures = 0;
                        currentIntervalMs =
                            pollResult.intervalMs ?? currentIntervalMs;
                        scheduleNextPoll(jitterDelay(currentIntervalMs));
                        return;
                    }

                    if (pollResult.error === "slow_down") {
                        slowDownCount += 1;
                        transientFailures = 0;
                        currentIntervalMs =
                            pollResult.intervalMs ??
                            baseDelayMs + slowDownCount * 5000;
                        scheduleNextPoll(jitterDelay(currentIntervalMs));
                        return;
                    }

                    if (pollResult.error) {
                        if (pollResult.error === "expired_token") {
                            terminateFlow(
                                "Authorization code expired. Please try again.",
                            );
                            return;
                        }
                        if (pollResult.error === "access_denied") {
                            terminateFlow("Authorization was denied.");
                            return;
                        }
                        if (pollResult.error === "device_flow_disabled") {
                            terminateFlow(
                                "Device Flow is disabled for this GitHub app.",
                            );
                            return;
                        }
                        if (pollResult.retryable) {
                            transientFailures += 1;
                            if (transientFailures > maxTransientFailures) {
                                terminateFlow(
                                    "Connection lost during polling. Please try again.",
                                );
                                return;
                            }
                            scheduleNextPoll(jitterDelay(currentIntervalMs));
                            return;
                        }

                        terminateFlow(pollResult.error);
                        return;
                    }

                    scheduleNextPoll(jitterDelay(currentIntervalMs));
                    return;
                } catch (err: unknown) {
                    logger.warn("github device flow poll unexpected error", {
                        error: toErrorData(err),
                    });

                    transientFailures += 1;
                    if (transientFailures > maxTransientFailures) {
                        terminateFlow(
                            "An unexpected error occurred. Please try again.",
                        );
                        return;
                    }

                    scheduleNextPoll(jitterDelay(currentIntervalMs));
                    return;
                }
            };

            scheduleNextPoll(jitterDelay(currentIntervalMs));
        } catch (err) {
            logger.error("github device flow start failed", {
                error: toErrorData(err),
            });
            terminateFlow("Sign-in failed");
        }
    }, [checkAuthStatus, terminateFlow, loading]);

    const signOut = useCallback(async () => {
        try {
            await githubSignOut();
        } catch (err) {
            logger.warn("Failed to sign out on backend", {
                error: toErrorData(err),
            });
        }
        signInGuardRef.current = false;
        cancelDeviceFlowInternal();
        setIsAuthenticated(false);
        setUsername(null);
        terminateFlow();
    }, [terminateFlow]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const cancelDeviceFlow = useCallback(() => {
        terminateFlow();
    }, [terminateFlow]);

    return (
        <GitHubAuthContext.Provider
            value={{
                isAuthenticated,
                username,
                loading,
                error,
                signIn,
                signOut,
                clearError,
            }}
        >
            {children}
            <GitHubDeviceFlowModal
                isOpen={deviceFlowActive}
                userCode={userCode}
                verificationUri={verificationUri}
                verificationUriComplete={verificationUriComplete || undefined}
                onCancel={cancelDeviceFlow}
            />
        </GitHubAuthContext.Provider>
    );
}

export function useGitHubAuth() {
    const context = useContext(GitHubAuthContext);
    if (context === undefined) {
        throw new Error(
            "useGitHubAuth must be used within a GitHubAuthProvider",
        );
    }
    return context;
}
