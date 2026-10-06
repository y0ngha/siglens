'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { getNewsCardsAction } from '@/entities/news-article/actions/getNewsCardsAction';
import type { NewsDisplayItem } from '@/shared/lib/types';
import { POLL_INTERVAL_MS } from '@/shared/config/cardPollingConfig';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { usePollingQuery } from '@/shared/hooks/usePollingQuery';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import {
    type CardListPollPolicy,
    decideCardListPoll,
    INITIAL_CARD_POLL_COUNTERS,
} from '@/entities/news-article/lib/cardPollDecision';

/**
 * Called once when polling terminates normally (all cards enriched, or timeout
 * with at least some cards present). Receives the final card snapshot so the
 * caller can decide whether any meaningful change occurred. Not called when
 * polling ends due to an empty news list or consecutive errors.
 */
export type OnPollingComplete = (finalItems: NewsDisplayItem[]) => void;

/**
 * SSR이 이미 보강된 행을 갖고 있어도 뉴스 탭은 뒤에서 FMP 새로고침을 돌린다. 그래서 이만큼은
 * 확인한 뒤에야 "새 소식 확인 중" 표시를 끄고 "전부 보강됨"으로 끝낸다.
 */
const REFRESH_SNAPSHOT_MIN_POLLS = 5;

const LIST_POLICY: CardListPollPolicy = {
    completeMinPolls: REFRESH_SNAPSHOT_MIN_POLLS,
    errorsCountAsPolls: true,
    completeOnTimeout: true,
};

export interface UseNewsCardPollingReturn {
    items: NewsDisplayItem[];
    isPolling: boolean;
    pollError: Error | null;
}

/**
 * Keeps the news card list up-to-date while background analysis is in progress.
 *
 * 마운트하면 `usePollingQuery`(키 `newsCards`)가 3초마다 `getNewsCardsAction`을 불러
 * DB 스냅샷을 받는다. 같은 탭의 AI 요약 대기(`useWaitForNewsCards`)와 쿼리를 나눠 써서 요청은
 * 한 번만 나가고, 숨은 탭에서는 멈추며, 응답이 이전과 같으면 `items` 참조가 그대로라 목록이
 * 다시 그려지지 않는다. 종료 조건은 `decideCardListPoll` 참고.
 *
 * `pollError` becomes non-null after `MAX_CONSECUTIVE_FAILURES` consecutive
 * polling errors so the consuming component can rethrow it for the surrounding
 * error boundary to catch.
 *
 * 첫 응답 전에는 `initialItems`(SSR 스냅샷)를 보여 준다.
 */
export function useNewsCardPolling(
    symbol: string,
    initialItems: NewsDisplayItem[],
    onPollingComplete?: OnPollingComplete
): UseNewsCardPollingReturn {
    const [isPolling, setIsPolling] = useState(true);
    const [pollError, setPollError] = useState<Error | null>(null);
    // Reset on symbol change in render (React-recommended "store information
    // from previous renders" pattern).
    // https://react.dev/reference/react/useState#storing-information-from-previous-renders
    const [prevSymbol, setPrevSymbol] = useState(symbol);
    // 종목별 카운터. 종목이 바뀌면(같은 인스턴스가 남는 경우) 처음부터 센다.
    const countersRef = useRef({
        symbol,
        counters: INITIAL_CARD_POLL_COUNTERS,
    });
    // 판정 콜백은 렌더 밖(쿼리 갱신 알림)에서 불리므로 최신 값은 ref로 읽는다.
    const onPollingCompleteRef = useRef(onPollingComplete);
    const latestItemsRef = useRef(initialItems);

    const locale = useCurrentLocale();
    const data = usePollingQuery<NewsDisplayItem[]>({
        queryKey: QUERY_KEYS.newsCards(symbol, locale),
        queryFn: () => getNewsCardsAction(symbol),
        intervalMs: POLL_INTERVAL_MS,
        enabled: true,
        // 서버 스냅샷으로 시작한다 — 이전 방문의 캐시가 이번 스냅샷을 덮지 않는다.
        initialData: initialItems,
        onSettled: (outcome, elapsedMs) => {
            const step = decideCardListPoll(
                countersRef.current.symbol === symbol
                    ? countersRef.current.counters
                    : INITIAL_CARD_POLL_COUNTERS,
                outcome,
                elapsedMs,
                latestItemsRef.current,
                LIST_POLICY
            );
            if (step.failedPollError !== null) {
                console.error(
                    '[useNewsCardPolling] poll failed:',
                    step.failedPollError
                );
            }
            countersRef.current = { symbol, counters: step.counters };
            if (step.settled) setIsPolling(false);
            if (step.error !== null) setPollError(step.error);
            if (step.completedItems !== null) {
                onPollingCompleteRef.current?.([...step.completedItems]);
            }
            return step.stop ? 'stop' : 'continue';
        },
    });

    if (prevSymbol !== symbol) {
        setPrevSymbol(symbol);
        setIsPolling(true);
        setPollError(null);
    }

    const items = data ?? initialItems;

    useLayoutEffect(() => {
        onPollingCompleteRef.current = onPollingComplete;
        latestItemsRef.current = items;
    });

    return { items, isPolling, pollError };
}
