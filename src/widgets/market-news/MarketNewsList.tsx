'use client';

import type { NewsFeedCategoryId } from '@/entities/market-news';
import { useState } from 'react';
import type { MarketNewsCardItem } from '@/entities/market-news';
import { MARKET_NEWS_LOOKBACK_DAYS } from '@/entities/market-news';

import {
    MARKET_NEWS_LIST_PAGE_SIZE,
    MARKET_NEWS_ROW_SERIALIZATION_LIMIT,
} from './constants';
import { useMarketNewsCardPolling } from './hooks/useMarketNewsCardPolling';
import { MarketNewsCard } from './MarketNewsCard';

const SKELETON_COUNT = 3;
const PERIOD_LABEL = `최근 ${MARKET_NEWS_LOOKBACK_DAYS}일`;

function MarketNewsListHeader() {
    return (
        <div className="flex items-center justify-between gap-2">
            <h2
                id="market-news-list-heading"
                className="text-lg font-semibold tracking-tight"
            >
                최신 시장 뉴스
            </h2>
            <span className="rounded bg-secondary-700 px-2 py-0.5 text-xs text-secondary-300">
                {PERIOD_LABEL}
            </span>
        </div>
    );
}

function MarketNewsCardSkeleton() {
    return (
        <article
            aria-hidden="true"
            className="rounded-xl border border-secondary-700 bg-secondary-800 p-4"
        >
            <div className="h-5 w-4/5 animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
            <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="h-5 w-10 animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
                <div className="h-5 w-24 animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
                <div className="h-4 w-20 animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
            </div>
            <div className="mt-3 space-y-1.5">
                <div className="h-3.5 w-full animate-pulse rounded bg-secondary-700/70 motion-reduce:animate-none" />
                <div className="h-3.5 w-2/3 animate-pulse rounded bg-secondary-700/70 motion-reduce:animate-none" />
            </div>
        </article>
    );
}

function LoadingState() {
    return (
        <section
            aria-labelledby="market-news-list-heading"
            aria-busy="true"
            className="w-full max-w-full min-w-0 space-y-3 overflow-hidden"
        >
            <MarketNewsListHeader />
            <span
                className="block text-xs text-secondary-400"
                aria-live="polite"
                aria-atomic="true"
            >
                뉴스 수집 중…
            </span>
            <ul className="space-y-3">
                {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                    <li key={i}>
                        <MarketNewsCardSkeleton />
                    </li>
                ))}
            </ul>
        </section>
    );
}

export interface MarketNewsListProps {
    category: NewsFeedCategoryId;
    initialItems: MarketNewsCardItem[];
}

/**
 * Client-side market-news list with background polling for AI enrichment.
 *
 * Renders `initialItems` (SSR snapshot) immediately and polls
 * `getMarketNewsCardsAction(category)` every 3 s in the background via
 * `useMarketNewsCardPolling` until all cards are enriched or polling is
 * terminated (5-min ceiling, 3 consecutive failures, 20 empty snapshots).
 *
 * `aria-busy` on the section signals to assistive technology that the list
 * is updating while polling is active.
 */
export function MarketNewsList({
    category,
    initialItems,
}: MarketNewsListProps) {
    const [visibleCount, setVisibleCount] = useState(
        MARKET_NEWS_LIST_PAGE_SIZE
    );
    const [prevCategory, setPrevCategory] = useState(category);

    if (prevCategory !== category) {
        setPrevCategory(category);
        setVisibleCount(MARKET_NEWS_LIST_PAGE_SIZE);
    }

    const {
        items: polledItems,
        isPolling,
        pollError,
    } = useMarketNewsCardPolling(category, initialItems);

    // 서버 렌더와 폴링 액션이 모두 같은 상한을 쓰지만, 렌더 직전에 한 번 더 맞춘다 —
    // 어느 한쪽이 상한을 잃으면 첫 페인트의 "더보기 (40개 남음)"이 폴링 직후 실제
    // 전체 개수로 튄다. 화면이 다루는 행 수를 한쪽에서만 제한할 이유가 없다.
    const items =
        polledItems.length > MARKET_NEWS_ROW_SERIALIZATION_LIMIT
            ? polledItems.slice(0, MARKET_NEWS_ROW_SERIALIZATION_LIMIT)
            : polledItems;

    if (pollError !== null) {
        throw pollError;
    }

    if (items.length === 0) {
        if (isPolling) {
            return <LoadingState />;
        }

        return (
            <section
                aria-labelledby="market-news-list-heading"
                className="w-full max-w-full min-w-0 overflow-hidden rounded-xl border border-secondary-700 bg-secondary-800 p-6"
            >
                <MarketNewsListHeader />
                <p className="text-sm text-secondary-400">
                    지난 {MARKET_NEWS_LOOKBACK_DAYS}일 동안 들어온 뉴스가
                    없어요.
                </p>
            </section>
        );
    }

    const visible = items.slice(0, visibleCount);
    const hasMore = visibleCount < items.length;

    return (
        <section
            aria-labelledby="market-news-list-heading"
            aria-busy={isPolling}
            className="w-full max-w-full min-w-0 space-y-3 overflow-hidden"
        >
            <MarketNewsListHeader />
            <ul className="space-y-3">
                {visible.map(item => (
                    <li key={item.id}>
                        <MarketNewsCard category={category} item={item} />
                    </li>
                ))}
            </ul>
            {hasMore && (
                <button
                    type="button"
                    onClick={() =>
                        setVisibleCount(c => c + MARKET_NEWS_LIST_PAGE_SIZE)
                    }
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-secondary-700 py-2 text-sm text-secondary-400 transition-colors hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    더보기 ({items.length - visibleCount}개 남음)
                </button>
            )}
        </section>
    );
}
