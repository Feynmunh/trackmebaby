interface TimeAgoOptions {
    justNowLabel?: string;
    emptyLabel?: string;
    maxDays?: number;
}

export function timeAgo(
    dateStr: string | null,
    options: TimeAgoOptions = {},
): string {
    const emptyLabel = options.emptyLabel ?? "";
    if (!dateStr) return emptyLabel;

    const date = new Date(dateStr);
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return options.justNowLabel ?? "just now";
    if (mins < 60) return `${mins}m ago`;

    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    const maxDays = options.maxDays ?? 7;
    if (days < maxDays) return `${days}d ago`;
    return date.toLocaleDateString();
}

export function nowIso(): string {
    return new Date().toISOString();
}
