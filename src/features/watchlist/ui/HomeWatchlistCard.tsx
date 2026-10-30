'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { LINK_ACCENT } from '@/shared/lib/linkStyles';
import { PLACEHOLDER_ON_CARD, SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { useWatchlistPreviewTabs } from '../hooks/useWatchlistPreviewTabs';
import {
    HOME_WATCHLIST_EMPTY_HEIGHT,
    WATCHLIST_SUBTLE_LINK,
} from '../lib/watchlistStyles';
import {
    watchlistPageHref,
    watchlistPanelId,
    watchlistTabId,
} from '../lib/watchlistTabs';
import { HomeWatchlistEmptyCard } from './home/HomeWatchlistEmptyCard';
import { HomeWatchlistItems } from './home/HomeWatchlistItems';
import { WatchlistTabs } from './WatchlistTabs';

const HEADING_ID = 'home-watchlist-heading';

/**
 * 홈 히어로 아래 "내 관심종목" 카드. 상태가 셋이다:
 * - 담은 것도 최근 본 것도 없으면 빈 카드(검색·인기 종목으로 안내)
 * - 담은 것은 없고 최근 본 것이 있으면 최근 본 탭이 열린 카드
 * - 담은 것이 있으면 관심 탭이 열린 카드
 * 홈은 캐시되는 페이지라 이 카드는 클라이언트 아일랜드다. 서버 HTML에는 내용 없는 자리표시자만
 * 있고(크롤러가 읽을 본문이 없다), 크롤러가 따라갈 종목 링크는 아래 인기 종목 섹션이 서버 렌더로 낸다.
 */
export function HomeWatchlistCard() {
    const t = useTranslations('features.watchlist');
    const idBase = useId();
    const { watchlist, recent, isReady, tab, selectTab, rows } =
        useWatchlistPreviewTabs();

    if (!isReady) {
        return (
            <div
                aria-hidden="true"
                className={cn(
                    SURFACE_CARD,
                    HOME_WATCHLIST_EMPTY_HEIGHT,
                    'animate-pulse p-5'
                )}
            >
                <div className={cn('h-5 w-28 rounded', PLACEHOLDER_ON_CARD)} />
            </div>
        );
    }
    if (watchlist.length === 0 && recent.length === 0) {
        return <HomeWatchlistEmptyCard headingId={HEADING_ID} />;
    }

    const href = watchlistPageHref(tab);

    return (
        <section
            aria-labelledby={HEADING_ID}
            className={cn(SURFACE_CARD, 'p-4 sm:p-5')}
        >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h2 id={HEADING_ID} className={cn(HEADING_SECTION, 'mr-1')}>
                    {t('home.heading')}
                </h2>
                <WatchlistTabs
                    value={tab}
                    onChange={selectTab}
                    watchlistCount={watchlist.length}
                    idBase={idBase}
                />
                <div className="ml-auto flex items-center">
                    {tab === 'watchlist' && watchlist.length > 0 && (
                        <Link
                            href="/watchlist"
                            prefetch={false}
                            className={WATCHLIST_SUBTLE_LINK}
                        >
                            {t('preview.edit')}
                        </Link>
                    )}
                    <Link
                        href={href}
                        prefetch={false}
                        className={cn(
                            LINK_ACCENT,
                            'inline-flex min-h-10 items-center rounded px-2 text-sm'
                        )}
                    >
                        {t('home.viewAll')}
                    </Link>
                </div>
            </div>
            <div
                role="tabpanel"
                id={watchlistPanelId(idBase)}
                aria-labelledby={watchlistTabId(idBase, tab)}
                className="mt-3"
            >
                <HomeWatchlistItems tab={tab} rows={rows} moreHref={href} />
            </div>
        </section>
    );
}
