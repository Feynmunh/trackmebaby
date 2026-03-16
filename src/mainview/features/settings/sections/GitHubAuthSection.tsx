import { useGitHubAuth } from "../../../contexts/GitHubAuthContext.tsx";

export default function GitHubAuthSection() {
    const {
        isAuthenticated: githubAuthenticated,
        username: githubUsername,
        loading: githubLoading,
        error: githubError,
        signIn: handleGitHubSignIn,
        signOut: handleGitHubSignOut,
        clearError,
    } = useGitHubAuth();

    return (
        <div className="bg-app-surface rounded-xl shadow-app-sm text-[14px]">
            <div className="px-4 py-3 border-b border-app-border">
                <h2 className="text-[13px] font-semibold text-app-text-main uppercase tracking-wide">
                    GitHub
                </h2>
            </div>
            <div className="px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-app-bg shrink-0 text-app-text-muted">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 16 16"
                                fill="currentColor"
                                className="w-5 h-5"
                            >
                                <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
                            </svg>
                        </div>
                        <div className="min-w-0">
                            {githubAuthenticated ? (
                                <div>
                                    <span className="text-[14px] text-app-text-main font-medium">
                                        Signed in as{" "}
                                        <span className="text-app-accent font-semibold">
                                            {githubUsername || "unknown"}
                                        </span>
                                    </span>
                                    <p className="text-[12px] text-app-text-muted truncate">
                                        Issues and pull requests are visible
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <span className="text-[14px] text-app-text-main font-medium">
                                        GitHub Account
                                    </span>
                                    <p className="text-[12px] text-app-text-muted truncate">
                                        Sign in to view issues and pull requests
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                        {githubAuthenticated ? (
                            <button
                                key="btn-signout"
                                id="settings-github-signout"
                                onClick={handleGitHubSignOut}
                                className="px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all active:scale-[0.98] bg-app-bg hover:bg-red-500/10 hover:text-red-400 text-app-text-muted border border-transparent"
                            >
                                Sign out
                            </button>
                        ) : (
                            <button
                                key="btn-signin"
                                id="settings-github-signin"
                                onClick={() => {
                                    clearError();
                                    void handleGitHubSignIn();
                                }}
                                disabled={githubLoading}
                                className="px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all active:scale-[0.98] bg-app-bg hover:bg-app-hover text-app-text-main border border-app-border disabled:opacity-40"
                            >
                                {githubLoading ? (
                                    <span className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full border-2 border-app-text-main border-t-transparent animate-spin" />
                                        Waiting…
                                    </span>
                                ) : (
                                    "Sign in with GitHub"
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {githubError && (
                    <p className="text-[12px] mt-3 text-red-400">
                        {githubError}
                    </p>
                )}
            </div>
        </div>
    );
}
