import type { ReactNode } from "react";
import GitHubSignInPrompt from "./GitHubSignInPrompt.tsx";

interface StatCardProps {
    title: string;
    value: ReactNode;
    icon: ReactNode;
    onClick?: () => void;
    loading?: boolean;
    loadingIndicator?: ReactNode;
    showAuthPrompt?: boolean;
    authPromptLabel: string;
    onAuthClick?: () => void;
    authLoading?: boolean;
    authValueClassName?: string;
    authLabelClassName?: string;
    className?: string;
    iconWrapperClassName?: string;
    valueClassName?: string;
    titleClassName?: string;
    children?: ReactNode;
}

export default function StatCard({
    title,
    value,
    icon,
    onClick,
    loading,
    loadingIndicator,
    showAuthPrompt = false,
    authPromptLabel,
    onAuthClick,
    authLoading,
    authValueClassName,
    authLabelClassName,
    className,
    iconWrapperClassName,
    valueClassName,
    titleClassName,
    children,
}: StatCardProps) {
    return (
        <div onClick={onClick} className={`group ${className ?? ""}`}>
            <div className={iconWrapperClassName}>{icon}</div>
            {showAuthPrompt ? (
                <>
                    <div className={authValueClassName ?? "text-2xl mb-1"}>
                        <GitHubSignInPrompt
                            onClick={onAuthClick}
                            loading={authLoading}
                        />
                    </div>
                    <div
                        className={
                            authLabelClassName ??
                            "text-[10px] font-bold text-mac-secondary uppercase tracking-widest opacity-60"
                        }
                    >
                        {authPromptLabel}
                    </div>
                </>
            ) : (
                <>
                    <div
                        className={
                            valueClassName ??
                            "text-2xl font-black text-mac-text mb-1 h-8 flex items-center"
                        }
                    >
                        {loading ? loadingIndicator : value}
                    </div>
                    <div
                        className={
                            titleClassName ??
                            "text-[10px] font-bold text-mac-secondary uppercase tracking-widest opacity-60"
                        }
                    >
                        {title}
                    </div>
                </>
            )}
            {children}
        </div>
    );
}
