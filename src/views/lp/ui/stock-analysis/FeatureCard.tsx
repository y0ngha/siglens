/**
 * One `/lp/stock-analysis` feature card.
 */
import { cn } from '@/shared/lib/cn';
import { SITE_URL } from '@/shared/lib/seo';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import type { Feature } from '../../lib/types';
import { LpIconTile } from '../LpIconTile';

const TEXT_LINK =
    'rounded text-secondary-300 underline underline-offset-2 hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

/**
 * Icon, `h3` with the market scope beside it, body, and a link into a real
 * symbol tab. Renders the `<li>` itself, so it goes straight into a `<ul>`.
 * The space after the title keeps title and scope apart in the heading's
 * accessible name; the flex gap only separates them visually.
 */
export function FeatureCard({
    Icon,
    title,
    scope,
    body,
    href,
    example,
}: Feature) {
    return (
        <li
            className={cn(
                SURFACE_CARD,
                'grid grid-cols-[2.5rem_minmax(0,1fr)] grid-rows-[auto_1fr_auto] gap-x-3.5 gap-y-1 p-4 sm:p-5'
            )}
        >
            <LpIconTile Icon={Icon} className="row-span-3" />
            <h3
                className={cn(
                    'flex flex-wrap items-baseline gap-x-2',
                    HEADING_SUBSECTION
                )}
            >
                {title}{' '}
                <span className="text-xs font-normal text-secondary-400">
                    {scope}
                </span>
            </h3>
            <p className="text-sm leading-6 text-secondary-300">{body}</p>
            <a
                href={`${SITE_URL}${href}`}
                className={cn(
                    TEXT_LINK,
                    'mt-1 inline-flex min-h-8 w-fit items-center text-xs'
                )}
            >
                {example}
            </a>
        </li>
    );
}
