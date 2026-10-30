'use client';

import { useRef, useState } from 'react';
import type { NewsDisplayItem } from '@/shared/lib/types';
import { POLL_INTERVAL_MS } from '@/shared/config/cardPollingConfig';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { usePollingQuery } from '@/shared/hooks/usePollingQuery';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { getNewsCardsAction } from '../actions/getNewsCardsAction';
import {
    type CardWaitPollPolicy,
    decideCardWaitPoll,
    hasAnyEnrichedCard,
    INITIAL_CARD_POLL_COUNTERS,
} from '../lib/cardPollDecision';

/** {@link useWaitForNewsCards}의 반환값. */
interface UseWaitForNewsCardsReturn {
    isReady: boolean;
    pollError: Error | null;
}

const WAIT_POLICY: CardWaitPollPolicy = {
    stopOnEmpty: true,
    timeoutIsError: false,
};

/**
 * DB에 `symbol`의 보강된(AI 분석이 붙은) 뉴스 카드가 하나라도 있으면 `isReady = true`.
 *
 * `initiallyReady`가 이미 `true`(SSR 스냅샷에 보강 카드가 있음)면 폴링 없이 즉시 준비된다.
 * 아니면 보강 카드가 나타날 때까지 3초마다 `getNewsCardsAction`을 폴링한다 — 그때가 AI
 * 집계 분석을 안전하게 트리거할 수 있는 시점이다.
 *
 * `pollError`는 `MAX_CONSECUTIVE_FAILURES`번 연속 폴링이 실패한 뒤에 non-null이 되어, 소비
 * 컴포넌트가 다시 던져 주변 에러 바운더리가 잡게 할 수 있다.
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
    // 렌더 중에 종목 변경을 감지해 초기화한다(React 권장 패턴).
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
