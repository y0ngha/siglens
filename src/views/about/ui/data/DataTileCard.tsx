/** One "what one ticker page covers" tile of the `/about` data section. */
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD, SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { LocaleLink } from '@/shared/ui/LocaleLink';
import type { DataTile } from '../../lib/types';
import { TEXT_LINK } from '../aboutStyles';

interface DataTileCardProps {
    readonly tile: DataTile;
}

/**
 * Icon, h3 with the markets it covers, a one-line body and a link into a
 * real ticker tab.
 */
export function DataTileCard({ tile }: DataTileCardProps) {
    const { Icon, title, body, scope, href, exampleLabel } = tile;
    return (
        <li
            className={cn(
                SURFACE_CARD,
                'grid grid-cols-[2.5rem_minmax(0,1fr)] grid-rows-[auto_1fr_auto] gap-x-3.5 gap-y-1 p-4 sm:p-5'
            )}
        >
            <span
                className={cn(
                    SURFACE_NESTED,
                    'row-span-3 flex size-10 items-center justify-center text-secondary-200'
                )}
            >
                <Icon className="size-5" />
            </span>
            <h3
                className={cn(
                    HEADING_SUBSECTION,
                    'flex flex-wrap items-baseline gap-x-2'
                )}
            >
                {title}
                <span className="text-xs font-normal text-secondary-400">
                    {scope}
                </span>
            </h3>
            <p className="text-sm leading-6 text-secondary-300">{body}</p>
            <LocaleLink
                href={href}
                className={cn(
                    TEXT_LINK,
                    'mt-1 inline-flex min-h-8 w-fit items-center text-xs'
                )}
            >
                {exampleLabel}
            </LocaleLink>
        </li>
    );
}
