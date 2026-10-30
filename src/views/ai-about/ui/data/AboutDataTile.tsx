import type { ComponentType } from 'react';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD, SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import {
    BuildingIcon,
    CandlesIcon,
    LayersIcon,
    NewsIcon,
    OptionsIcon,
    PortfolioIcon,
    QuoteIcon,
    SparkIcon,
} from '@/shared/ui/StrokeIcons';
import type { DataTile, DataTileId } from '../../lib/aboutSections';

type IconComponent = ComponentType<{ className?: string }>;

/** The stroke icon drawn on each data-source tile. */
const DATA_TILE_ICON: Record<DataTileId, IconComponent> = {
    quote: QuoteIcon,
    chart: CandlesIcon,
    analysis: SparkIcon,
    news: NewsIcon,
    options: OptionsIcon,
    company: BuildingIcon,
    market: LayersIcon,
    portfolio: PortfolioIcon,
};

interface Props {
    readonly tile: DataTile;
}

/**
 * One data-source card. Its title is an h3 under the section's h2, so it takes
 * the shared subsection token and stays a step below the h2 in size, weight
 * and colour.
 */
export function AboutDataTile({ tile: { id, title, body, scope } }: Props) {
    const Icon = DATA_TILE_ICON[id];
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
            <h3 className={HEADING_SUBSECTION}>{title}</h3>
            <p className="text-sm leading-6 text-secondary-300">{body}</p>
            <p className="mt-1 text-xs text-secondary-400">{scope}</p>
        </li>
    );
}
