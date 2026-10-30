'use client';

import { useTranslations } from 'next-intl';
import {
    HOME_WATCHLIST_DESKTOP_COUNT,
    HOME_WATCHLIST_MOBILE_COUNT,
} from '@/shared/config/watchlist';
import { cn } from '@/shared/lib/cn';
import { LINK_ACCENT } from '@/shared/lib/linkStyles';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { useIsBelowLg } from '../../hooks/useIsBelowLg';
import type { WatchlistPreviewItem } from '../../hooks/useWatchlistPreview';
import type { WatchlistPreviewTab } from '../../lib/watchlistTabs';
import { MiniQuoteRow } from '../MiniQuoteRow';
import { HomeWatchlistAddCard } from './HomeWatchlistAddCard';
import { HomeWatchlistDesktopCard } from './HomeWatchlistDesktopCard';

interface HomeWatchlistItemsProps {
    tab: WatchlistPreviewTab;
    /** 지금 탭의 전체 행. 뷰포트별 상한까지만 그린다. */
    rows: WatchlistPreviewItem[];
    /** 모바일 "더 보기"의 목적지 — 지금 탭이 열린 `/watchlist`. */
    moreHref: string;
}

/**
 * 홈 카드 탭 패널의 본문. 뷰포트에 맞는 한쪽만 그린다 — 숨긴 쪽도 시세를 요청하지 않게.
 * `isBelowLg`가 null인 구간은 하이드레이션 렌더뿐이고, 그때는 카드가 자리표시자를 그리므로
 * 빈 본문이 보이는 프레임은 없다.
 */
export function HomeWatchlistItems({
    tab,
    rows,
    moreHref,
}: HomeWatchlistItemsProps) {
    const t = useTranslations('features.watchlist');
    const isBelowLg = useIsBelowLg();

    if (rows.length === 0) {
        // 키는 정적으로 적는다 — i18n 추출기가 동적 조회를 보지 못한다.
        return (
            <p className="py-6 text-center text-sm text-secondary-400">
                {tab === 'watchlist'
                    ? t('preview.emptyWatchlist')
                    : t('preview.emptyRecent')}
            </p>
        );
    }

    const mobileItems = rows.slice(0, HOME_WATCHLIST_MOBILE_COUNT);
    const hiddenOnMobile = rows.length - mobileItems.length;

    if (isBelowLg === false) {
        return (
            <ul className="grid grid-cols-6 gap-3">
                {rows.slice(0, HOME_WATCHLIST_DESKTOP_COUNT).map(item => (
                    <HomeWatchlistDesktopCard key={item.symbol} item={item} />
                ))}
                <li>
                    <HomeWatchlistAddCard />
                </li>
            </ul>
        );
    }
    if (isBelowLg === null) return null;
    return (
        <>
            <ul className="-mx-1.5">
                {mobileItems.map(item => (
                    <MiniQuoteRow key={item.symbol} item={item} quotesEnabled />
                ))}
            </ul>
            {hiddenOnMobile > 0 && (
                <Link
                    href={moreHref}
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
    );
}
