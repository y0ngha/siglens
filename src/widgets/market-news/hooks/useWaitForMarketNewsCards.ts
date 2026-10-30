'use client';

/**
 * 다이제스트가 기다리는 "보강된 카드가 하나라도 생김" 조건의 폴링 훅.
 */
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
import { marketNewsCardsWaitKey } from '../utils/marketNewsCardsWaitKey';
import { useHiddenDuration } from './useHiddenDuration';

export interface WaitForMarketNewsCardsResult {
    isReady: boolean;
    waitError: Error | null;
}

const WAIT_POLICY: CardWaitPollPolicy = {
    stopOnEmpty: false,
    // 다이제스트는 5분을 넘기면 대기 실패 화면(재시도)으로 넘어간다 — FMP가 빈 결과를 주거나
    // LLM 작업이 조용히 전부 실패해도 끝없이 기다리지 않게.
    timeoutIsError: true,
};

/**
 * 보강된 카드(`sentiment !== null`)가 하나라도 생길 때까지 마켓 뉴스 카드를 폴링한다.
 * `initiallyReady`가 참이면 폴링 없이 곧바로 `isReady = true`다.
 *
 * 같은 화면의 카드 목록 폴러(`useMarketNewsCardPolling`)와 쿼리(`marketNewsCards`)를 나눠
 * 쓴다(첫 시도 한정 — `marketNewsCardsWaitKey`). 그래서 준비 여부는 이 훅이 받은 응답이
 * 아니라 **쿼리 데이터**로 판정한다.
 *
 * 5분 상한은 탭이 **보이던** 시간만 센다. 폴러는 숨은 탭에서 멈추는데 경과 시간은 벽시계로
 * 흐르므로, 오래 숨겼다 돌아온 사용자가 폴링 한 번 못 해 보고 대기 실패를 보게 된다
 * (`useHiddenDuration`이 숨은 시간을 빼 준다). `attempt`가 오르면 대기를 처음부터 다시
 * 시작한다 — 오류를 비우고 카운터와 상한 시계를 새로 센다.
 */
export function useWaitForMarketNewsCards(
    category: NewsFeedCategoryId,
    initiallyReady: boolean,
    attempt: number = 0
): WaitForMarketNewsCardsResult {
    const scope = `${category}:${attempt}`;
    const [waitError, setWaitError] = useState<Error | null>(null);
    const [prevScope, setPrevScope] = useState(scope);
    // 범위(카테고리·시도)별 카운터. 범위가 바뀌면(같은 인스턴스가 남는 경우) 처음부터 센다.
    const countersRef = useRef({
        scope,
        counters: INITIAL_CARD_POLL_COUNTERS,
    });
    const getHiddenMs = useHiddenDuration(scope);

    const locale = useCurrentLocale();
    const data = usePollingQuery<MarketNewsCardItem[]>({
        queryKey: marketNewsCardsWaitKey(
            QUERY_KEYS.marketNewsCards(category, locale),
            attempt
        ),
        queryFn: () => fetchMarketNewsCards(category),
        intervalMs: POLL_INTERVAL_MS,
        enabled: !initiallyReady,
        onSettled: (outcome, elapsedMs) => {
            const step = decideCardWaitPoll(
                countersRef.current.scope === scope
                    ? countersRef.current.counters
                    : INITIAL_CARD_POLL_COUNTERS,
                outcome,
                elapsedMs - getHiddenMs(),
                WAIT_POLICY
            );
            if (step.failedPollError !== null) {
                console.error(
                    '[useWaitForMarketNewsCards] poll failed:',
                    step.failedPollError
                );
            }
            // 상한 초과는 실패한 폴이 없어 위에서 기록되지 않는다 — 사용자에게는 일반 문구만 보이므로 여기서 남긴다.
            if (step.error !== null && step.failedPollError === null) {
                console.error(
                    '[useWaitForMarketNewsCards] wait failed:',
                    step.error
                );
            }
            countersRef.current = { scope, counters: step.counters };
            if (step.error !== null) setWaitError(step.error);
            return step.stop ? 'stop' : 'continue';
        },
    });

    if (prevScope !== scope) {
        setPrevScope(scope);
        setWaitError(null);
    }

    const isReady =
        initiallyReady || (data !== undefined && hasAnyEnrichedCard(data));

    return { isReady, waitError };
}
