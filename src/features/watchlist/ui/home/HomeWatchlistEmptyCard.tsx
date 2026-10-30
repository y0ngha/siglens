'use client';

import { useTranslations } from 'next-intl';
import { HOME_POPULAR_ANCHOR_ID } from '@/shared/config/watchlist';
import { BUTTON_OUTLINE, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { StarIcon } from '@/shared/ui/StrokeIcons';
import { useOpenTickerSearch } from '../../hooks/useOpenTickerSearch';
import { HOME_WATCHLIST_EMPTY_HEIGHT } from '../../lib/watchlistStyles';

interface HomeWatchlistEmptyCardProps {
    /** 카드 `section`을 이름 짓는 제목 id. 채워진 카드와 같은 id를 쓴다. */
    headingId: string;
}

/** 담은 것도 최근 본 것도 없을 때의 홈 카드 — 검색과 아래 인기 종목 섹션으로 안내한다. */
export function HomeWatchlistEmptyCard({
    headingId,
}: HomeWatchlistEmptyCardProps) {
    const t = useTranslations('features.watchlist');
    const openSearch = useOpenTickerSearch();
    return (
        <section
            aria-labelledby={headingId}
            className={cn(
                SURFACE_CARD,
                HOME_WATCHLIST_EMPTY_HEIGHT,
                'flex flex-col gap-4 p-5 sm:flex-row sm:items-center'
            )}
        >
            <span
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary-900/30 text-primary-400"
            >
                <StarIcon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
                <h2 id={headingId} className={HEADING_SECTION}>
                    {t('home.heading')}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-secondary-400">
                    {t('common.emptyBody')}
                </p>
            </div>
            <div className="flex shrink-0 gap-2">
                <button
                    type="button"
                    onClick={openSearch}
                    className={cn(
                        BUTTON_PRIMARY,
                        'h-11 flex-1 px-4 text-sm sm:flex-none'
                    )}
                >
                    {t('common.search')}
                </button>
                <a
                    href={`#${HOME_POPULAR_ANCHOR_ID}`}
                    className={cn(
                        BUTTON_OUTLINE,
                        'h-11 flex-1 px-4 text-sm sm:flex-none'
                    )}
                >
                    {t('home.popular')}
                </a>
            </div>
        </section>
    );
}
