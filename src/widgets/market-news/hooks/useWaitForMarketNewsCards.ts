'use client';

import type { NewsFeedCategoryId } from '@/entities/market-news/lib/categoryConfig';
import { useRef, useState } from 'react';
import type { MarketNewsCardItem } from '@/entities/market-news/lib/toCardItem';
import { POLL_INTERVAL_MS } from '@/shared/config/cardPollingConfig';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { usePollingQuery } from '@/shared/hooks/usePollingQuery';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import {
    type CardWaitPollPolicy,
    decideCardWaitPoll,
    hasAnyEnrichedCard,
    INITIAL_CARD_POLL_COUNTERS,
} from '@/entities/news-article/lib/cardPollDecision';
import { fetchMarketNewsCards } from '../utils/fetchMarketNewsCards';

export interface WaitForMarketNewsCardsResult {
    isReady: boolean;
    waitError: Error | null;
}

const WAIT_POLICY: CardWaitPollPolicy = {
    stopOnEmpty: false,
    // 다이제스트는 5분을 넘기면 대기 실패 화면(재시도)으로 넘어간다 — FMP가 빈 결과를 주거나
    // LLM 작업이 조용히 전부 실패해도 끝없이 기다리지 않게.
    timeoutIsError: true,
    logTag: 'useWaitForMarketNewsCards',
};

/**
 * Poll market-news cards until at least one enriched card (sentiment !== null)
 * is available, then resolve. Returns `isReady = true` immediately if
 * `initiallyReady` is true.
 *
 * 같은 화면의 카드 목록 폴러(`useMarketNewsCardPolling`)와 쿼리(`marketNewsCards`)를 나눠
 * 쓴다. 그래서 준비 여부는 이 훅이 받은 응답이 아니라 **쿼리 데이터**로 판정한다.
 */
export function useWaitForMarketNewsCards(
    category: NewsFeedCategoryId,
    initiallyReady: boolean
): WaitForMarketNewsCardsResult {
    const [waitError, setWaitError] = useState<Error | null>(null);
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
        enabled: !initiallyReady,
        onSettled: (outcome, elapsedMs) => {
            const step = decideCardWaitPoll(
                countersRef.current.category === category
                    ? countersRef.current.counters
                    : INITIAL_CARD_POLL_COUNTERS,
                outcome,
                elapsedMs,
                WAIT_POLICY
            );
            countersRef.current = { category, counters: step.counters };
            if (step.error !== null) setWaitError(step.error);
            return step.stop ? 'stop' : 'continue';
        },
    });

    if (prevCategory !== category) {
        setPrevCategory(category);
        setWaitError(null);
    }

    const isReady =
        initiallyReady || (data !== undefined && hasAnyEnrichedCard(data));

    return { isReady, waitError };
}
