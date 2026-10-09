import type { ComponentType } from 'react';
import type { GuideCategory } from '@/entities/guide/types';
import { guideCategoryPath } from '@/shared/lib/guidePaths';
import { CARD_LINK_CLASSES } from '@/shared/lib/cardStyles';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import {
    CandlesIcon,
    GaugeIcon,
    LayersIcon,
    QuoteIcon,
} from '@/shared/ui/StrokeIcons';
import { LocaleLink } from '@/shared/ui/LocaleLink';

type IconComponent = ComponentType<{ className?: string }>;

const CATEGORY_ICON: Readonly<Record<GuideCategory, IconComponent>> = {
    candlesticks: CandlesIcon,
    'chart-patterns': QuoteIcon,
    indicators: GaugeIcon,
    strategies: LayersIcon,
};

export interface GuideCategoryTile {
    readonly category: GuideCategory;
    readonly label: string;
    readonly count: string;
}

interface GuideCategoryTilesProps {
    /** 이 목록을 설명하는 이름(내비게이션 랜드마크 이름). */
    readonly label: string;
    readonly tiles: readonly GuideCategoryTile[];
}

/** 분류 허브로 가는 타일 줄. 분류 허브 하단에서 다른 분류로 건너가는 길이다. */
export function GuideCategoryTiles({ label, tiles }: GuideCategoryTilesProps) {
    return (
        <nav aria-label={label}>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {tiles.map(({ category, label: name, count }) => {
                    const Icon = CATEGORY_ICON[category];
                    return (
                        <li key={category} className="flex">
                            <LocaleLink
                                href={guideCategoryPath(category)}
                                prefetch={false}
                                className={cn(
                                    SURFACE_CARD,
                                    CARD_LINK_CLASSES,
                                    'group w-full p-4'
                                )}
                            >
                                <span className="flex items-center gap-3">
                                    <Icon className="size-5 shrink-0 text-secondary-400 transition-colors group-hover:text-primary-400 motion-reduce:transition-none" />
                                    <span className="min-w-0">
                                        <span className="block text-sm font-medium text-secondary-100">
                                            {name}
                                        </span>
                                        <span className="block text-xs text-secondary-400 tabular-nums">
                                            {count}
                                        </span>
                                    </span>
                                </span>
                            </LocaleLink>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
