'use client';

import { useHideOnScrollDown } from '@/widgets/layout';
import { cn } from '@/shared/lib/cn';

interface Props {
    readonly title: string;
    readonly cta: string;
    readonly href: string;
}

/**
 * The "ask now" bar pinned under the site header on `/about`, so the way into
 * the chat is always one tap away.
 *
 * It sits at `top-14`, right below the sticky header. On phones the ai host
 * slides that header away while scrolling down (`useHideOnScrollDown`, one
 * shared store), so the bar slides up by the same 56px on the same curve and
 * the two never leave a gap or overlap.
 */
export function AboutCtaBar({ title, cta, href }: Props) {
    const headerHidden = useHideOnScrollDown({ enabled: true });
    return (
        <div
            className={cn(
                'sticky top-14 z-40 border-b border-secondary-700 bg-secondary-800/95 shadow-lg shadow-secondary-950/40 backdrop-blur-md transition-transform duration-200 motion-reduce:transition-none',
                headerHidden && 'max-lg:-translate-y-14'
            )}
        >
            <div className="mx-auto flex min-h-14 max-w-4xl items-center justify-between gap-3 px-4">
                <p className="min-w-0 truncate text-sm font-semibold text-secondary-100">
                    {title}
                </p>
                <a
                    href={href}
                    className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-900 focus-visible:outline-none"
                >
                    {cta}
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className="size-4"
                    >
                        <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                </a>
            </div>
        </div>
    );
}
