'use client';

/**
 * 폴링 상태가 화면 분기를 정하므로 이 컴포넌트는 분기만 맡는다.
 */
import type { NewsFeedCategoryId } from '@/entities/market-news/lib/categoryConfig';
import type { MarketNewsCardItem } from '@/entities/market-news/lib/toCardItem';
import { useMarketNewsCardPolling } from './hooks/useMarketNewsCardPolling';
import { useMarketNewsPagination } from './hooks/useMarketNewsPagination';
import { capMarketNewsRows } from './utils/capMarketNewsRows';
import { getMarketNewsLookbackDays } from './utils/marketNewsLookback';
import { MarketNewsCard } from './MarketNewsCard';
import { MarketNewsListEmpty } from './ui/list/MarketNewsListEmpty';
import { MarketNewsListHeader } from './ui/list/MarketNewsListHeader';
import { MarketNewsListLoadingState } from './ui/list/MarketNewsListLoadingState';
import { MarketNewsLoadMoreButton } from './ui/list/MarketNewsLoadMoreButton';
import { MarketNewsPollNotice } from './ui/list/MarketNewsPollNotice';

export interface MarketNewsListProps {
    category: NewsFeedCategoryId;
    initialItems: MarketNewsCardItem[];
}

/**
 * SSR 스냅샷(`initialItems`)을 바로 그리고, AI 보강이 끝날 때까지 `useMarketNewsCardPolling`이
 * 백그라운드로 갱신한다. 폴링이 도는 동안 섹션은 `aria-busy`다.
 *
 * 폴링이 연속으로 실패해도 페이지를 에러 바운더리로 넘기지 않는다 — 마지막으로 받은 목록을
 * 그대로 두고, 보강 대기 스켈레톤은 걷어 보강 전 모습으로 보여 주며, 작은 안내만 덧붙인다.
 */
export function MarketNewsList({
    category,
    initialItems,
}: MarketNewsListProps) {
    const { visibleCount, showMore } = useMarketNewsPagination(category);
    const {
        items: polledItems,
        isPolling,
        pollError,
    } = useMarketNewsCardPolling(category, initialItems);
    const items = capMarketNewsRows(polledItems);
    const pollFailed = pollError !== null;
    // 실패뿐 아니라 5분 상한·정체·빈 스냅샷 반복처럼 오류 없이 끝난 폴링도 더는 보강 결과가
    // 오지 않는다. 첫 폴 전에는 isPolling이 true라 스켈레톤이 그대로 보인다.
    const enrichmentStopped = !isPolling;
    const lookbackDays = getMarketNewsLookbackDays();

    if (items.length === 0) {
        return isPolling ? (
            <MarketNewsListLoadingState lookbackDays={lookbackDays} />
        ) : (
            <MarketNewsListEmpty
                pollFailed={pollFailed}
                lookbackDays={lookbackDays}
            />
        );
    }

    return (
        <section
            aria-labelledby="market-news-list-heading"
            aria-busy={isPolling}
            className="w-full max-w-full min-w-0 space-y-3 overflow-hidden"
        >
            <MarketNewsListHeader lookbackDays={lookbackDays} />
            <ul className="space-y-3">
                {items.slice(0, visibleCount).map(item => (
                    <li key={item.id}>
                        <MarketNewsCard
                            category={category}
                            item={item}
                            enrichmentStopped={enrichmentStopped}
                        />
                    </li>
                ))}
            </ul>
            {pollFailed && <MarketNewsPollNotice />}
            {visibleCount < items.length && (
                <MarketNewsLoadMoreButton
                    remaining={items.length - visibleCount}
                    onClick={showMore}
                />
            )}
        </section>
    );
}
