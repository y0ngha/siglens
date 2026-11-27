'use client';

import { useTranslations } from 'next-intl';
import { HOME_POPULAR_ANCHOR_ID } from '@/shared/config/watchlist';
import { cn } from '@/shared/lib/cn';
import { LINK_ACCENT } from '@/shared/lib/linkStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { StarIcon } from '@/shared/ui/StrokeIcons';
import { HOME_WATCHLIST_EMPTY_HEIGHT } from '../../lib/watchlistStyles';

interface HomeWatchlistEmptyCardProps {
    /** 카드 `section`을 이름 짓는 제목 id. 채워진 카드와 같은 id를 쓴다. */
    headingId: string;
}

/**
 * 담은 것도 최근 본 것도 없을 때의 홈 카드 — 한 줄짜리 안내와 아래 인기 종목으로 가는 링크.
 *
 * 검색 버튼은 두지 않는다: 바로 위 히어로가 검색창이고, 같은 일을 하는 버튼을 한 화면에 둘 두면
 * 첫 방문자의 모바일 화면만 길어진다. 제목은 시각적으로 숨기되(`sr-only`) 영역 이름은 그대로 남는다.
 */
export function HomeWatchlistEmptyCard({
    headingId,
}: HomeWatchlistEmptyCardProps) {
    const t = useTranslations('features.watchlist');
    return (
        <section
            aria-labelledby={headingId}
            className={cn(
                SURFACE_CARD,
                HOME_WATCHLIST_EMPTY_HEIGHT,
                'flex flex-wrap items-center gap-x-3 gap-y-1 p-4'
            )}
        >
            <h2 id={headingId} className="sr-only">
                {t('home.heading')}
            </h2>
            <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-900/30 text-primary-400"
            >
                <StarIcon className="size-5" />
            </span>
            <p className="min-w-0 flex-1 basis-56 text-sm leading-relaxed text-secondary-400">
                {t('common.emptyBody')}
            </p>
            <a
                href={`#${HOME_POPULAR_ANCHOR_ID}`}
                className={cn(
                    LINK_ACCENT,
                    'inline-flex min-h-10 shrink-0 items-center rounded px-2 text-sm'
                )}
            >
                {t('home.popular')}
            </a>
        </section>
    );
}
