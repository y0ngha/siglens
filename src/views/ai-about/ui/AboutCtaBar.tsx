'use client';

import { useHideOnScrollDown } from '@/shared/hooks/useHideOnScrollDown';
import { cn } from '@/shared/lib/cn';
import { ArrowRightIcon } from '@/shared/ui/StrokeIcons';

interface Props {
    readonly title: string;
    readonly cta: string;
    readonly href: string;
}

/**
 * The "ask now" bar pinned under the site header on `/about`, so the way into
 * the chat is always one tap away.
 *
 * It sits right below the sticky header (`--header-h`). On phones the ai host
 * slides that header away while scrolling down (`useHideOnScrollDown`, one
 * shared store), so the bar slides up by the same height on the same curve and
 * the two never leave a gap or overlap.
 *
 * Like the rest of the ai host it is separated by `ai-bar` (light, not a 1px
 * line). Its height and `data-ai-about-cta` are read by globals.css to place the
 * top install banner below it (`--ai-about-cta-h`).
 */
export function AboutCtaBar({ title, cta, href }: Props) {
    const headerHidden = useHideOnScrollDown({ enabled: true });
    return (
        <div
            data-ai-about-cta=""
            className={cn(
                'ai-bar sticky top-(--header-h) z-40 bg-secondary-800/95 backdrop-blur-md transition-transform duration-200 motion-reduce:transition-none',
                headerHidden && 'max-lg:-translate-y-[var(--header-h)]'
            )}
        >
            <div className="mx-auto flex h-(--ai-about-cta-h) max-w-4xl items-center justify-between gap-3 px-4">
                <p className="min-w-0 truncate text-sm font-semibold text-secondary-100">
                    {title}
                </p>
                <a
                    href={href}
                    className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-900 focus-visible:outline-none"
                >
                    {cta}
                    <ArrowRightIcon className="size-4" />
                </a>
            </div>
        </div>
    );
}
