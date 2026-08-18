'use client';

import { useState, useEffect } from 'react';
import { getNewsCardsAction } from '@/entities/news-article/actions';
import type { NewsDisplayItem } from '@/shared/lib/types';
import {
    POLL_INTERVAL_MS,
    MAX_CONSECUTIVE_FAILURES,
    MAX_POLL_DURATION_MS,
    EMPTY_SNAPSHOT_MAX_POLLS,
} from '../constants';

function hasAnyEnrichedCard(items: NewsDisplayItem[]): boolean {
    return items.some(item => item.sentiment !== null);
}

interface UseWaitForNewsCardsReturn {
    isReady: boolean;
    pollError: Error | null;
}

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
 */
export function useWaitForNewsCards(
    symbol: string,
    initiallyReady: boolean
): UseWaitForNewsCardsReturn {
    const [isReady, setIsReady] = useState(initiallyReady);
    const [pollError, setPollError] = useState<Error | null>(null);
    // Reset on symbol change in render (React-recommended pattern). Boolean
    // `initiallyReady` is read inside the effect via deps; we don't compare it
    // here to keep the reset trigger minimal and avoid any chance of
    // render-time setState loops on unstable parent renders.
    // https://react.dev/reference/react/useState#storing-information-from-previous-renders
    const [prevSymbol, setPrevSymbol] = useState(symbol);

    if (prevSymbol !== symbol) {
        setPrevSymbol(symbol);
        setIsReady(initiallyReady);
        setPollError(null);
    }

    useEffect(() => {
        if (initiallyReady) return;

        let consecutiveFailures = 0;
        let pollCount = 0;
        const startedAt = Date.now();
        // 종목이 바뀌면 effect가 다시 돌지만, **이미 날아간 요청**은 취소되지 않는다
        // (`clearInterval`은 다음 tick만 막는다). 그 응답이 늦게 도착해 새 종목의
        // 상태에 `setIsReady(true)`를 찍으면, 카드가 보강되지 않은 종목에서 분석
        // 패널이 열리고 core가 `no_news`를 돌려준다 — `retry:false` +
        // `staleTime:Infinity`라 그 에러가 영구 캐시된다(`NewsAiSummary` 주석 참조).
        // 소비자에 `key={symbol}`이 없어 remount로도 안 끊긴다(감사 라운드 14).
        let cancelled = false;

        const intervalId = setInterval(async () => {
            // 5분 상한은 `cardPollingConfig`가 선언한 UX 계약이고 형제 훅
            // (`useNewsCardPolling`)은 지키고 있었다. 여기만 빠져 있어서, 보강될
            // 카드가 아예 없는 종목에서는 탭이 열려 있는 내내 3초마다 server action
            // POST + Neon 조회가 나갔다 — 8시간이면 9,600회로 계약 상한(100회)의
            // 96배다(감사: 비용 라운드 13).
            if (Date.now() - startedAt > MAX_POLL_DURATION_MS) {
                clearInterval(intervalId);
                return;
            }
            try {
                const fresh = await getNewsCardsAction(symbol);
                if (cancelled) return;
                consecutiveFailures = 0;
                pollCount += 1;
                if (hasAnyEnrichedCard(fresh)) {
                    setIsReady(true);
                    clearInterval(intervalId);
                    return;
                }
                // 기사 자체가 없으면 보강될 것도 없다 — 형제 훅과 같은 상한으로
                // 일찍 접는다(5분을 다 기다릴 이유가 없다).
                if (
                    fresh.length === 0 &&
                    pollCount >= EMPTY_SNAPSHOT_MAX_POLLS
                ) {
                    clearInterval(intervalId);
                }
            } catch (err) {
                if (cancelled) return;
                consecutiveFailures += 1;
                console.error('[useWaitForNewsCards] poll failed:', err);
                if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                    setPollError(
                        err instanceof Error ? err : new Error(String(err))
                    );
                    clearInterval(intervalId);
                }
            }
        }, POLL_INTERVAL_MS);

        return () => {
            cancelled = true;
            clearInterval(intervalId);
        };
    }, [symbol, initiallyReady]);

    return { isReady, pollError };
}
