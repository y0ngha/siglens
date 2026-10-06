'use client';

import type { NewsFeedCategoryId } from '@/entities/market-news/lib/categoryConfig';
import { useRef, useState } from 'react';
import type { MarketNewsCardItem } from '@/entities/market-news/lib/toCardItem';
import { POLL_INTERVAL_MS } from '@/shared/config/cardPollingConfig';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { usePollingQuery } from '@/shared/hooks/usePollingQuery';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import {
    type CardListPollPolicy,
    decideCardListPoll,
    INITIAL_CARD_POLL_COUNTERS,
} from '@/entities/news-article/lib/cardPollDecision';
import { fetchMarketNewsCards } from '../utils/fetchMarketNewsCards';

export interface UseMarketNewsCardPollingReturn {
    items: MarketNewsCardItem[];
    isPolling: boolean;
    pollError: Error | null;
}

const LIST_POLICY: CardListPollPolicy = {
    completeMinPolls: 0,
    errorsCountAsPolls: false,
    completeOnTimeout: false,
    logTag: 'useMarketNewsCardPolling',
};

const EMPTY_ITEMS: readonly MarketNewsCardItem[] = [];

/**
 * Keeps the market-news card list up-to-date while background analysis is in
 * progress for a given feed category.
 *
 * `usePollingQuery`(키 `marketNewsCards`)로 `POLL_INTERVAL_MS`마다 폴링한다. 같은 화면의
 * 다이제스트 대기(`useWaitForMarketNewsCards`)와 쿼리를 나눠 써서 요청이 한 번만 나가고,
 * 숨은 탭에서는 멈추며, 응답이 이전과 같으면 목록이 다시 그려지지 않는다. 종료 조건은
 * `decideCardListPoll` — 전건 보강, 5분 상한, 연속 실패, 빈 스냅샷 반복, 정체.
 *
 * Pass a stable `key` on the consuming list to force a fresh-mount reset
 * when the snapshot array identity must drive a reset (e.g. client navigation).
 */
export function useMarketNewsCardPolling(
    category: NewsFeedCategoryId,
    initialItems: MarketNewsCardItem[]
): UseMarketNewsCardPollingReturn {
    const [isPolling, setIsPolling] = useState(true);
    const [pollError, setPollError] = useState<Error | null>(null);
    // Reset on category change in render (React-recommended "store information
    // from previous renders" pattern).
    // https://react.dev/reference/react/useState#storing-information-from-previous-renders
    const [prevCategory, setPrevCategory] = useState(category);
    // 카테고리별 카운터. 카테고리가 바뀌면(같은 인스턴스가 남는 경우) 처음부터 센다.
    const countersRef = useRef({
        category,
        counters: INITIAL_CARD_POLL_COUNTERS,
    });

    const locale = useCurrentLocale();
    const data = usePollingQuery<MarketNewsCardItem[]>({
        queryKey: QUERY_KEYS.marketNewsCards(category, locale),
        queryFn: () => fetchMarketNewsCards(category),
        intervalMs: POLL_INTERVAL_MS,
        enabled: true,
        // 서버 스냅샷으로 시작한다 — 이전 방문의 캐시가 이번 스냅샷을 덮지 않는다.
        initialData: initialItems,
        onSettled: (outcome, elapsedMs) => {
            const step = decideCardListPoll(
                countersRef.current.category === category
                    ? countersRef.current.counters
                    : INITIAL_CARD_POLL_COUNTERS,
                outcome,
                elapsedMs,
                // 마켓 뉴스는 상한 종료 때 완료를 알리지 않아 최신 목록이 필요 없다.
                EMPTY_ITEMS,
                LIST_POLICY
            );
            countersRef.current = { category, counters: step.counters };
            if (step.stop) setIsPolling(false);
            if (step.error !== null) setPollError(step.error);
            return step.stop ? 'stop' : 'continue';
        },
    });

    if (prevCategory !== category) {
        setPrevCategory(category);
        setIsPolling(true);
        setPollError(null);
    }

    return { items: data ?? initialItems, isPolling, pollError };
}
