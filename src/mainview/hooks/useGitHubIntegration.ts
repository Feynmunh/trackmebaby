import { useEffect, useState } from "react";
import { toErrorData } from "../../shared/error.ts";
import { createLogger } from "../../shared/logger.ts";
import type { GitHubData } from "../../shared/types.ts";
import { useGitHubAuth } from "../contexts/GitHubAuthContext.tsx";
import { getGitHubData } from "../rpc";

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
    const {
        isAuthenticated: isGitHubAuthenticated,
        signIn: handleGitHubSignIn,
        loading: authLoading,
    } = useGitHubAuth();

    const [githubData, setGithubData] = useState<GitHubData | null>(null);
    const [githubLoading, setGithubLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        let dataRetries = 0;

        const fetchGitHubData = async () => {
            if (cancelled || !isGitHubAuthenticated) return;
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

        if (isGitHubAuthenticated) {
            fetchGitHubData();
        } else {
            setGithubData(null);
            setGithubLoading(false);
        }

        return () => {
            cancelled = true;
        };
    }, [projectId, isGitHubAuthenticated]);

    return {
        isGitHubAuthenticated,
        githubData,
        githubLoading: githubLoading || authLoading,
        handleGitHubSignIn,
    };
}
