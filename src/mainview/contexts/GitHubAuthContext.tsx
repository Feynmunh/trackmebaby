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

export function GitHubAuthProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [username, setUsername] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [deviceFlowActive, setDeviceFlowActive] = useState(false);
    const [userCode, setUserCode] = useState("");
    const [verificationUri, setVerificationUri] = useState("");
    const pollTimeoutRef = useRef<Timer | null>(null);
    const activeFlowRef = useRef(false);

    const clearPollTimer = useCallback(() => {
        if (pollTimeoutRef.current) {
            clearTimeout(pollTimeoutRef.current);
            pollTimeoutRef.current = null;
        }
    }, []);

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
        if (loading) return;
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
                const errorMsg = result.error || "Failed to start sign-in";
                setError(errorMsg);
                setLoading(false);
                activeFlowRef.current = false;
                return;
            }

            setUserCode(result.userCode);
            setVerificationUri(result.verificationUri);
            setDeviceFlowActive(true);

            const startTime = Date.now();
            const hardExpiryMs = (result.expiresIn || 900) * 1000;
            const baseDelayMs = Math.max((result.interval || 5) * 1000, 1000);
            const maxDelayMs = 30000;
            const maxTransientFailures = 12;
            let pendingAttempts = 0;
            let transientFailures = 0;

            const scheduleNextPoll = (delayMs: number) => {
                if (!activeFlowRef.current) return;

                if (Date.now() - startTime > hardExpiryMs) {
                    activeFlowRef.current = false;
                    clearPollTimer();
                    setError("Authorization code expired. Please try again.");
                    setLoading(false);
                    setDeviceFlowActive(false);
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

            const backoffDelay = (attempt: number): number => {
                const cappedAttempt = Math.min(attempt, 6);
                const delay = Math.min(
                    maxDelayMs,
                    baseDelayMs * 2 ** cappedAttempt,
                );
                return jitterDelay(delay);
            };

            const poll = async () => {
                if (!activeFlowRef.current) return;
                try {
                    const pollResult = await githubPollDeviceFlow(
                        result.deviceCode!,
                    );
                    if (pollResult.success) {
                        clearPollTimer();
                        activeFlowRef.current = false;
                        await checkAuthStatus();
                        setLoading(false);
                        setDeviceFlowActive(false);
                        return;
                    }

                    if (pollResult.error === "pending") {
                        pendingAttempts += 1;
                        scheduleNextPoll(backoffDelay(pendingAttempts));
                        return;
                    }

                    if (pollResult.error === "slow_down") {
                        pendingAttempts += 1;
                        scheduleNextPoll(backoffDelay(pendingAttempts + 1));
                        return;
                    }

                    if (pollResult.error) {
                        if (pollResult.retryable) {
                            transientFailures += 1;
                            if (transientFailures > maxTransientFailures) {
                                activeFlowRef.current = false;
                                clearPollTimer();
                                setError(
                                    "Connection lost during polling. Please try again.",
                                );
                                setLoading(false);
                                setDeviceFlowActive(false);
                                return;
                            }
                            scheduleNextPoll(backoffDelay(transientFailures));
                            return;
                        }

                        activeFlowRef.current = false;
                        clearPollTimer();
                        setError(pollResult.error);
                        setLoading(false);
                        setDeviceFlowActive(false);
                        return;
                    }

                    pendingAttempts += 1;
                    scheduleNextPoll(backoffDelay(pendingAttempts));
                    return;
                } catch (err: unknown) {
                    logger.warn("github device flow poll unexpected error", {
                        error: toErrorData(err),
                    });

                    transientFailures += 1;
                    if (transientFailures > maxTransientFailures) {
                        activeFlowRef.current = false;
                        clearPollTimer();
                        setError(
                            "An unexpected error occurred. Please try again.",
                        );
                        setLoading(false);
                        setDeviceFlowActive(false);
                        return;
                    }

                    scheduleNextPoll(backoffDelay(transientFailures));
                    return;
                }
            };

            scheduleNextPoll(jitterDelay(baseDelayMs));
        } catch (err) {
            const errorMsg = "Sign-in failed";
            logger.error("github device flow start failed", {
                error: toErrorData(err),
            });
            setError(errorMsg);
            activeFlowRef.current = false;
            clearPollTimer();
            setLoading(false);
            setDeviceFlowActive(false);
        }
    }, [checkAuthStatus, clearPollTimer, loading]);

    const signOut = useCallback(async () => {
        try {
            await githubSignOut();
        } catch (err) {
            logger.warn("Failed to sign out on backend", {
                error: toErrorData(err),
            });
        }
        setIsAuthenticated(false);
        setUsername(null);
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const cancelDeviceFlow = useCallback(() => {
        clearPollTimer();
        activeFlowRef.current = false;
        setDeviceFlowActive(false);
        setLoading(false);
    }, [clearPollTimer]);

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
