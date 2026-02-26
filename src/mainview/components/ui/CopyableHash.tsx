import { useState } from "react";
import Tooltip from "./Tooltip.tsx";

interface CopyableHashProps {
    hash: string;
}

export default function CopyableHash({ hash }: CopyableHashProps) {
    const [copied, setCopied] = useState(false);

    const copy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(hash);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Tooltip content={copied ? "Copied!" : "Click to copy"}>
            <button
                onClick={copy}
                className="text-xs text-mac-secondary font-mono bg-mac-bg px-2.5 py-1 rounded-lg border border-mac-border/50 hover:border-mac-accent/40 hover:text-mac-accent transition-all block"
            >
                {hash.slice(0, 7)}
            </button>
        </Tooltip>
    );
}
