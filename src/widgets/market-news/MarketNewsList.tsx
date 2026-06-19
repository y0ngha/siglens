'use client';

import { useState } from 'react';
import type { MarketNewsCardItem } from '@/entities/market-news';
import { MARKET_NEWS_LOOKBACK_DAYS } from '@/entities/market-news';
import type { NewsFeedCategory } from '@y0ngha/siglens-core';
import { useMarketNewsCardPolling } from './hooks/useMarketNewsCardPolling';
import { MarketNewsCard } from './MarketNewsCard';

const PAGE_SIZE = 10;
const SKELETON_COUNT = 3;
const PERIOD_LABEL = `최근 ${MARKET_NEWS_LOOKBACK_DAYS}일`;

function MarketNewsListHeader() {
    return (
        <div className="flex items-center justify-between gap-2">
            <h2
                id="market-news-list-heading"
                className="text-lg font-semibold tracking-tight"
            >
                최신 마켓 뉴스
            </h2>
            <span className="bg-secondary-700 text-secondary-300 rounded px-2 py-0.5 text-xs">
                {PERIOD_LABEL}
            </span>
        </div>
    );
}

function MarketNewsCardSkeleton() {
    return (
        <article
            aria-hidden="true"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-4"
        >
            <div className="bg-secondary-700 h-5 w-4/5 animate-pulse rounded motion-reduce:animate-none" />
            <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="bg-secondary-700 h-5 w-10 animate-pulse rounded motion-reduce:animate-none" />
                <div className="bg-secondary-700 h-5 w-24 animate-pulse rounded motion-reduce:animate-none" />
                <div className="bg-secondary-700 h-4 w-20 animate-pulse rounded motion-reduce:animate-none" />
            </div>
            <div className="mt-3 space-y-1.5">
                <div className="bg-secondary-700/70 h-3.5 w-full animate-pulse rounded motion-reduce:animate-none" />
                <div className="bg-secondary-700/70 h-3.5 w-2/3 animate-pulse rounded motion-reduce:animate-none" />
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
                className="text-secondary-400 block text-xs"
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
    category: NewsFeedCategory;
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
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [prevCategory, setPrevCategory] = useState(category);

    if (prevCategory !== category) {
        setPrevCategory(category);
        setVisibleCount(PAGE_SIZE);
    }

    const { items, isPolling, pollError } = useMarketNewsCardPolling(
        category,
        initialItems
    );

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
                className="border-secondary-700 bg-secondary-800 w-full max-w-full min-w-0 overflow-hidden rounded-xl border p-6"
            >
                <MarketNewsListHeader />
                <p className="text-secondary-400 text-sm">
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
                    onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                    className="border-secondary-700 text-secondary-400 hover:text-secondary-100 focus-visible:ring-primary-500 inline-flex min-h-11 w-full items-center justify-center rounded-lg border py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                    더보기 ({items.length - visibleCount}개 남음)
                </button>
            )}
        </section>
    );
}
