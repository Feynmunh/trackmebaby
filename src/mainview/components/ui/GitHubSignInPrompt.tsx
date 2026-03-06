interface GitHubSignInPromptProps {
    onClick?: () => void;
    loading?: boolean;
    variant?: "compact" | "large";
}

export default function GitHubSignInPrompt({
    onClick,
    loading,
    variant = "compact",
}: GitHubSignInPromptProps) {
    if (variant === "large") {
        return (
            <button
                onClick={onClick}
                disabled={loading}
                className="group/signin flex flex-col items-start gap-2 text-left"
            >
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-app-accent/10 border border-app-accent/20 group-hover/signin:bg-app-accent/20 transition-all duration-300">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="w-4 h-4 text-app-accent"
                    >
                        <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
                    </svg>
                    <span className="text-[11px] font-black text-app-accent uppercase tracking-widest">
                        {loading ? "Connecting…" : "Connect"}
                    </span>
                </div>
            </button>
        );
    }

    return (
        <button
            onClick={onClick}
            disabled={loading}
            className="w-full text-left group/signin"
        >
            <div className="flex items-center gap-1.5 mt-1">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="w-3.5 h-3.5 text-app-text-muted opacity-60 group-hover/signin:text-app-accent transition-colors"
                >
                    <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
                </svg>
                <span className="text-[10px] font-bold text-app-text-muted group-hover/signin:text-app-text-main transition-colors uppercase tracking-widest">
                    {loading ? "Connecting…" : "Sign In"}
                </span>
            </div>
        </button>
    );
}
