'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useOpenTickerSearch } from '@/shared/hooks/useOpenTickerSearch';
import {
    HOME_POPULAR_ANCHOR_ID,
    HOME_WATCHLIST_DESKTOP_COUNT,
    HOME_WATCHLIST_MOBILE_COUNT,
} from '@/shared/config/watchlist';
import { BUTTON_OUTLINE, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { PLACEHOLDER_ON_CARD, SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { StarIcon } from '@/shared/ui/StrokeIcons';
import {
    useWatchlistPreview,
    type WatchlistPreviewItem,
    type WatchlistPreviewTab,
} from '../hooks/useWatchlistPreview';
import { MiniQuote, MiniQuoteRow, MiniTrend } from './MiniQuoteRow';
import { watchlistPageHref } from './WatchlistPreviewPanel';
import {
    WatchlistTabs,
    watchlistPanelId,
    watchlistTabId,
} from './WatchlistTabs';

/**
 * 빈 카드와 하이드레이션 전 자리표시자가 같은 높이를 쓴다 — 첫 방문자(대부분의 검색 유입)는
 * 하이드레이션 순간 아무것도 밀리지 않는다. 이미 담아 둔 재방문자는 카드가 한 번 늘어난다
 * (예전 온보딩 블록이 3개 이상에서 접히던 것과 같은 성격의 변화다).
 */
const EMPTY_HEIGHT = 'min-h-[13.5rem] sm:min-h-[9rem]';

const LINK_SUBTLE =
    'inline-flex min-h-10 items-center rounded px-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

function DesktopCard({ item }: { item: WatchlistPreviewItem }) {
    return (
        <li>
            <Link
                href={`/${item.symbol}`}
                prefetch={false}
                className="flex h-full flex-col rounded-lg border border-border-control bg-secondary-900 p-3.5 transition-colors hover:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                <span className="truncate text-sm font-semibold text-secondary-50">
                    {item.name}
                </span>
                <span className="mt-0.5 font-mono text-xs text-secondary-400">
                    {item.symbol}
                </span>
                <MiniTrend
                    symbol={item.symbol}
                    enabled
                    className="mt-3 h-9 w-full"
                />
                <span className="mt-3">
                    <MiniQuote symbol={item.symbol} enabled align="start" />
                </span>
            </Link>
        </li>
    );
}

function EmptyCard() {
    const t = useTranslations('features.watchlist');
    const openSearch = useOpenTickerSearch();
    return (
        <section
            aria-labelledby="home-watchlist-heading"
            className={cn(
                SURFACE_CARD,
                EMPTY_HEIGHT,
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
                <h2 id="home-watchlist-heading" className={HEADING_SECTION}>
                    {t('home.heading')}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-secondary-400">
                    {t('home.emptyBody')}
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
                    {t('home.search')}
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

/**
 * 홈 히어로 아래 "내 관심종목" 카드(설계 §4.1). 상태가 셋이다:
 * - 담은 것도 최근 본 것도 없으면 빈 카드(검색·인기 종목으로 안내)
 * - 담은 것은 없고 최근 본 것이 있으면 최근 본 탭이 열린 카드
 * - 담은 것이 있으면 관심 탭이 열린 카드
 * 홈은 캐시되는 페이지라 이 카드는 클라이언트 아일랜드다. 크롤러는 빈 카드만 본다.
 */
export function HomeWatchlistCard() {
    const t = useTranslations('features.watchlist');
    const idBase = useId();
    const { watchlist, recent, isReady, defaultTab } = useWatchlistPreview();
    const [chosenTab, setChosenTab] = useState<WatchlistPreviewTab | null>(
        null
    );

    if (!isReady) {
        return (
            <div
                aria-hidden="true"
                className={cn(SURFACE_CARD, EMPTY_HEIGHT, 'animate-pulse p-5')}
            >
                <div className={cn('h-5 w-28 rounded', PLACEHOLDER_ON_CARD)} />
            </div>
        );
    }
    if (watchlist.length === 0 && recent.length === 0) return <EmptyCard />;

    const tab = chosenTab ?? defaultTab;
    const all = tab === 'watchlist' ? watchlist : recent;
    const desktopItems = all.slice(0, HOME_WATCHLIST_DESKTOP_COUNT);
    const mobileItems = all.slice(0, HOME_WATCHLIST_MOBILE_COUNT);
    const hiddenOnMobile = all.length - mobileItems.length;
    const href = watchlistPageHref(tab);

    return (
        <section
            aria-labelledby="home-watchlist-heading"
            className={cn(SURFACE_CARD, 'p-4 sm:p-5')}
        >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h2
                    id="home-watchlist-heading"
                    className={cn(HEADING_SECTION, 'mr-1')}
                >
                    {t('home.heading')}
                </h2>
                <WatchlistTabs
                    value={tab}
                    onChange={setChosenTab}
                    watchlistCount={watchlist.length}
                    idBase={idBase}
                />
                <div className="ml-auto flex items-center">
                    {tab === 'watchlist' && watchlist.length > 0 && (
                        <Link
                            href="/watchlist"
                            prefetch={false}
                            className={cn(
                                LINK_SUBTLE,
                                'text-secondary-400 hover:text-secondary-200'
                            )}
                        >
                            {t('preview.edit')}
                        </Link>
                    )}
                    <Link
                        href={href}
                        prefetch={false}
                        className={cn(
                            LINK_SUBTLE,
                            'font-semibold text-primary-400 hover:text-primary-300'
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
                {all.length === 0 ? (
                    <p className="py-6 text-center text-sm text-secondary-400">
                        {t('preview.emptyWatchlist')}
                    </p>
                ) : (
                    <>
                        <ul className="hidden grid-cols-6 gap-3 lg:grid">
                            {desktopItems.map(item => (
                                <DesktopCard key={item.symbol} item={item} />
                            ))}
                            <li>
                                <AddCard />
                            </li>
                        </ul>
                        <ul className="-mx-1.5 lg:hidden">
                            {mobileItems.map(item => (
                                <MiniQuoteRow
                                    key={item.symbol}
                                    item={item}
                                    quotesEnabled
                                />
                            ))}
                        </ul>
                        {hiddenOnMobile > 0 && (
                            <Link
                                href={href}
                                prefetch={false}
                                className="mt-1 flex min-h-11 items-center justify-center rounded-lg text-sm font-semibold text-primary-400 transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none lg:hidden"
                            >
                                {t('home.more', { v0: hiddenOnMobile })}
                            </Link>
                        )}
                    </>
                )}
            </div>
        </section>
    );
}

function AddCard() {
    const t = useTranslations('features.watchlist');
    const openSearch = useOpenTickerSearch();
    return (
        <button
            type="button"
            onClick={openSearch}
            className="flex size-full min-h-36 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-control text-sm text-secondary-300 transition-colors hover:border-primary-500 hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
        >
            <span aria-hidden="true" className="text-xl leading-none">
                +
            </span>
            {t('home.add')}
        </button>
    );
}
