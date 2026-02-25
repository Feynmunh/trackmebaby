import { ReactNode } from 'react';

interface TooltipProps {
    children: ReactNode;
    content: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
    className?: string;
}

export default function Tooltip({
    children,
    content,
    position = 'top',
    className = ''
}: TooltipProps) {
    const positionClasses = {
        top: '-top-10 left-1/2 -translate-x-1/2 -translate-y-1',
        bottom: '-bottom-10 left-1/2 -translate-x-1/2 translate-y-1',
        left: 'top-1/2 -left-2 -translate-x-full -translate-y-1/2 -ml-2',
        right: 'top-1/2 -right-2 translate-x-full -translate-y-1/2 ml-2'
    };

    const arrowClasses = {
        top: 'bottom-[-4px] left-1/2 -translate-x-1/2 border-t-mac-surface border-l-transparent border-r-transparent border-b-transparent',
        bottom: 'top-[-4px] left-1/2 -translate-x-1/2 border-b-mac-surface border-l-transparent border-r-transparent border-t-transparent',
        left: 'right-[-4px] top-1/2 -translate-y-1/2 border-l-mac-surface border-t-transparent border-b-transparent border-r-transparent',
        right: 'left-[-4px] top-1/2 -translate-y-1/2 border-r-mac-surface border-t-transparent border-b-transparent border-l-transparent'
    };

    return (
        <div className={`group/tooltip relative inline-flex ${className}`}>
            {children}
            <div className={`absolute ${positionClasses[position]} px-3 py-1.5 rounded-lg bg-mac-surface/90 backdrop-blur-md border border-mac-border text-[10px] font-bold text-mac-text whitespace-nowrap shadow-mac-lg z-[100] opacity-0 scale-90 group-hover/tooltip:opacity-100 group-hover/tooltip:scale-100 transition-all duration-150 pointer-events-none`}>
                {content}
                <div className={`absolute w-0 h-0 border-[4px] ${arrowClasses[position]}`} />
            </div>
        </div>
    );
}
