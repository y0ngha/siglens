'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useIsBelowLg } from '../hooks/useIsBelowLg';
import { useOpenTickerSearch } from '../hooks/useOpenTickerSearch';
import {
    HOME_POPULAR_ANCHOR_ID,
    HOME_WATCHLIST_DESKTOP_COUNT,
    HOME_WATCHLIST_MOBILE_COUNT,
} from '@/shared/config/watchlist';
import { BUTTON_OUTLINE, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { LINK_ACCENT } from '@/shared/lib/linkStyles';
import { PLACEHOLDER_ON_CARD, SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { StarIcon } from '@/shared/ui/StrokeIcons';
import {
    useWatchlistPreview,
    type WatchlistPreviewItem,
} from '../hooks/useWatchlistPreview';
import {
    watchlistPageHref,
    watchlistPanelId,
    watchlistTabId,
    type WatchlistPreviewTab,
} from '../lib/watchlistTabs';
import { WATCHLIST_SUBTLE_LINK } from '../lib/watchlistStyles';
import { MiniQuote, MiniQuoteRow, MiniTrend } from './MiniQuoteRow';
import { WatchlistTabs } from './WatchlistTabs';

/**
 * 빈 카드와 하이드레이션 전 자리표시자가 같은 높이를 쓴다 — 첫 방문자(대부분의 검색 유입)는
 * 하이드레이션 순간 아무것도 밀리지 않는다. 이미 담아 둔 재방문자는 카드가 한 번 늘어난다
 * (예전 온보딩 블록이 3개 이상에서 접히던 것과 같은 성격의 변화다).
 */
const EMPTY_HEIGHT = 'min-h-[13.5rem] sm:min-h-[9rem]';

interface DesktopCardProps {
    item: WatchlistPreviewItem;
}

function DesktopCard({ item }: DesktopCardProps) {
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
    const [chosenTab, setChosenTab] = useState<WatchlistPreviewTab | null>(
        null
    );
    const { watchlist, recent, isReady, defaultTab } = useWatchlistPreview();
    const isBelowLg = useIsBelowLg();

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
                {all.length === 0 ? (
                    <p className="py-6 text-center text-sm text-secondary-400">
                        {t('preview.emptyWatchlist')}
                    </p>
                ) : (
                    <>
                        {/* 뷰포트에 맞는 한쪽만 그린다 — 숨긴 쪽도 시세를 요청하지 않게. `isBelowLg`가
                            null인 구간은 하이드레이션 렌더뿐이고, 그때는 `isReady`도 false라 위의
                            자리표시자가 그려지므로 빈 본문이 보이는 프레임은 없다. */}
                        {isBelowLg === false && (
                            <ul className="grid grid-cols-6 gap-3">
                                {desktopItems.map(item => (
                                    <DesktopCard
                                        key={item.symbol}
                                        item={item}
                                    />
                                ))}
                                <li>
                                    <AddCard />
                                </li>
                            </ul>
                        )}
                        {isBelowLg === true && (
                            <ul className="-mx-1.5">
                                {mobileItems.map(item => (
                                    <MiniQuoteRow
                                        key={item.symbol}
                                        item={item}
                                        quotesEnabled
                                    />
                                ))}
                            </ul>
                        )}
                        {isBelowLg === true && hiddenOnMobile > 0 && (
                            <Link
                                href={href}
                                prefetch={false}
                                className={cn(
                                    LINK_ACCENT,
                                    'mt-1 flex min-h-11 items-center justify-center rounded-lg text-sm'
                                )}
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
            {t('common.add')}
        </button>
    );
}
