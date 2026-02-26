import { useCallback, useEffect, useRef, useState } from "react";
import { toErrorData } from "../../shared/error.ts";
import { createLogger } from "../../shared/logger.ts";
import type { GitHubData } from "../../shared/types.ts";
import { getGitHubAuthStatus, getGitHubData, githubStartAuth } from "../rpc";

const logger = createLogger("dashboard");

interface UseGitHubIntegrationResult {
    isGitHubAuthenticated: boolean;
    githubData: GitHubData | null;
    githubLoading: boolean;
    handleGitHubSignIn: () => Promise<void>;
}

export function useGitHubIntegration(
    projectId: string,
): UseGitHubIntegrationResult {
    const pollRef = useRef<Timer | null>(null);
    const [isGitHubAuthenticated, setIsGitHubAuthenticated] = useState(false);
    const [githubData, setGithubData] = useState<GitHubData | null>(null);
    const [githubLoading, setGithubLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        let authRetries = 0;
        let dataRetries = 0;

        const fetchGitHubData = async () => {
            if (cancelled) return;
            setGithubLoading(true);
            try {
                const data = await getGitHubData(projectId);
                if (cancelled) return;
                if (data) {
                    setGithubData(data);
                    setGithubLoading(false);
                    return;
                }
            } catch (err: unknown) {
                logger.warn("github data fetch failed", {
                    error: toErrorData(err),
                });
            }

            if (cancelled) return;
            dataRetries += 1;
            if (dataRetries <= 3) {
                setTimeout(fetchGitHubData, 400 * dataRetries);
            } else {
                setGithubLoading(false);
            }
        };

        const checkAuthAndLoad = async () => {
            let authenticated = false;
            try {
                const authStatus = await getGitHubAuthStatus();
                if (cancelled) return;
                authenticated = authStatus.authenticated;
                setIsGitHubAuthenticated(authenticated);
                if (!authenticated) {
                    setGithubLoading(false);
                    return;
                }
                dataRetries = 0;
                fetchGitHubData();
            } catch (err: unknown) {
                logger.warn("github auth status failed", {
                    error: toErrorData(err),
                });
                if (cancelled) return;
                setIsGitHubAuthenticated(false);
            }

            if (cancelled) return;
            if (authRetries < 5 && !authenticated) {
                authRetries += 1;
                setTimeout(checkAuthAndLoad, 200 * authRetries);
            }
        };

        checkAuthAndLoad();

        return () => {
            cancelled = true;
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [projectId]);

    const handleGitHubSignIn = useCallback(async () => {
        setGithubLoading(true);
        try {
            const result = await githubStartAuth();
            if (!result.success) {
                setGithubLoading(false);
                return;
            }

            let attempts = 0;
            pollRef.current = setInterval(async () => {
                attempts++;
                try {
                    const status = await getGitHubAuthStatus();
                    if (status.authenticated) {
                        if (pollRef.current) clearInterval(pollRef.current);
                        pollRef.current = null;
                        setIsGitHubAuthenticated(true);
                        const data = await getGitHubData(projectId);
                        setGithubData(data);
                        setGithubLoading(false);
                    } else if (attempts >= 60) {
                        if (pollRef.current) clearInterval(pollRef.current);
                        pollRef.current = null;
                        setGithubLoading(false);
                    }
                } catch (err: unknown) {
                    logger.warn("github auth poll failed", {
                        error: toErrorData(err),
                    });
                }
            }, 2000);
        } catch (err: unknown) {
            logger.error("github sign-in failed", { error: toErrorData(err) });
            setGithubLoading(false);
        }
    }, [projectId]);

    return {
        isGitHubAuthenticated,
        githubData,
        githubLoading,
        handleGitHubSignIn,
    };
}
