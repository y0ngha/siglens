'use client';

import { useRef, useState } from 'react';
import { getNewsCardsAction } from '@/entities/news-article/actions/getNewsCardsAction';
import type { NewsDisplayItem } from '@/shared/lib/types';
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

interface UseWaitForNewsCardsReturn {
    isReady: boolean;
    pollError: Error | null;
}

const WAIT_POLICY: CardWaitPollPolicy = {
    stopOnEmpty: true,
    timeoutIsError: false,
};

/**
 * Returns `isReady = true` when at least one enriched news card (with AI
 * analysis) is available in the DB for `symbol`.
 *
 * If `initiallyReady` is already `true` (the SSR snapshot contained enriched
 * cards), this resolves immediately without any polling.
 *
 * Otherwise, polls `getNewsCardsAction` every 3 s until an enriched card
 * appears — at which point the AI aggregate analysis can safely be triggered.
 *
 * `pollError` becomes non-null after `MAX_CONSECUTIVE_FAILURES` consecutive
 * polling errors so the consuming component can rethrow it for the surrounding
 * error boundary to catch.
 *
 * `enabled`가 `false`면 폴링하지 않는다 — 카드 보강(`useNewsAnalysisTrigger`)이 AI 자동
 * 실행 게이트로 미뤄진 동안에는 기다려도 카드가 생기지 않는다. 참이 되면 그때 시작한다.
 *
 * 폴링은 `usePollingQuery`(키 `newsCards`)로 돈다. 뉴스 탭에서는 카드 목록 폴러
 * (`useNewsCardPolling`)와 같은 쿼리를 나눠 써서 3초마다 요청이 하나만 나간다 — 예전에는 두
 * 훅이 같은 Server Action을 따로 불렀다. 그래서 준비 여부도 이 훅이 받은 응답이 아니라
 * **쿼리 데이터**로 판정한다(목록 폴러가 가져온 응답으로도 열린다).
 */
export function useWaitForNewsCards(
    symbol: string,
    initiallyReady: boolean,
    enabled = true
): UseWaitForNewsCardsReturn {
    const [pollError, setPollError] = useState<Error | null>(null);
    // Reset on symbol change in render (React-recommended pattern).
    // https://react.dev/reference/react/useState#storing-information-from-previous-renders
    const [prevSymbol, setPrevSymbol] = useState(symbol);
    // 종목별 카운터. 종목이 바뀌면(같은 인스턴스가 남는 경우) 처음부터 센다.
    const countersRef = useRef({
        symbol,
        counters: INITIAL_CARD_POLL_COUNTERS,
    });

    const locale = useCurrentLocale();
    const data = usePollingQuery<NewsDisplayItem[]>({
        queryKey: QUERY_KEYS.newsCards(symbol, locale),
        queryFn: () => getNewsCardsAction(symbol),
        intervalMs: POLL_INTERVAL_MS,
        enabled: enabled && !initiallyReady,
        onSettled: (outcome, elapsedMs) => {
            const step = decideCardWaitPoll(
                countersRef.current.symbol === symbol
                    ? countersRef.current.counters
                    : INITIAL_CARD_POLL_COUNTERS,
                outcome,
                elapsedMs,
                WAIT_POLICY
            );
            if (step.failedPollError !== null) {
                console.error(
                    '[useWaitForNewsCards] poll failed:',
                    step.failedPollError
                );
            }
            countersRef.current = { symbol, counters: step.counters };
            if (step.error !== null) setPollError(step.error);
            return step.stop ? 'stop' : 'continue';
        },
    });

    if (prevSymbol !== symbol) {
        setPrevSymbol(symbol);
        setPollError(null);
    }

    const isReady =
        initiallyReady || (data !== undefined && hasAnyEnrichedCard(data));

    return { isReady, pollError };
}
