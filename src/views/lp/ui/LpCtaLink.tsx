/**
 * The ad landing pages' primary call to action.
 */
import type { ReactNode } from 'react';
import { BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';

/** Ring offset matches the pages' `secondary-900` background. */
const LP_PRIMARY_BUTTON = cn(
    BUTTON_PRIMARY,
    'min-h-11 px-6 text-sm focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-900'
);

interface LpCtaLinkProps {
    readonly href: string;
    readonly className?: string;
    readonly children: ReactNode;
}

/** A primary-button link. A plain `<a>`: every target is on another host or a full page load. */
export function LpCtaLink({ href, className, children }: LpCtaLinkProps) {
    return (
        <a href={href} className={cn(LP_PRIMARY_BUTTON, className)}>
            {children}
        </a>
    );
}
