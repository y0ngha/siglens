'use client';

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { getNewsCardsAction } from '@/entities/news-article/actions';
import type { NewsDisplayItem } from '@/shared/lib/types';
import {
    POLL_INTERVAL_MS,
    MAX_CONSECUTIVE_FAILURES,
    EMPTY_SNAPSHOT_MAX_POLLS,
    MAX_POLL_DURATION_MS,
} from '../constants';

/**
 * Called once when polling terminates normally (all cards enriched, or timeout
 * with at least some cards present). Receives the final card snapshot so the
 * caller can decide whether any meaningful change occurred. Not called when
 * polling ends due to an empty news list or consecutive errors.
 */
export type OnPollingComplete = (finalItems: NewsDisplayItem[]) => void;

export {
    POLL_INTERVAL_MS,
    MAX_CONSECUTIVE_FAILURES,
    EMPTY_SNAPSHOT_MAX_POLLS,
    MAX_POLL_DURATION_MS,
};

const REFRESH_SNAPSHOT_MIN_POLLS = 5;

/**
 * 보강 진전이 이 횟수만큼 연속으로 없으면 폴링을 접는다.
 *
 * 카드 한 건의 LLM 왕복은 실측 **4~13초**이고(`newsAnalysisConstants` 참조) 방문자
 * 경로는 `withConcurrencyLimit`로 청크를 순차 실행한다 — 빠른 청크가 4초에 끝나고
 * 다음 청크가 13초 걸리면 쓰기 사이 침묵이 13초까지 벌어진다. 창을 그보다 짧게
 * 잡으면 **진행 중인 청크를 두고 접는다**: 서버가 보강한 카드가 열려 있는 페이지에
 * 영영 안 닿고, `onPollingComplete`가 부분 풀에 대고 invalidate를 쏜다.
 * 6틱 = 18초로 그 13초 위에 여유를 둔다.
 *
 * 단, **첫 보강이 도착한 뒤에만** 센다. 0건인 동안은 적재+LLM 왕복을 기다리는
 * 중일 뿐이라, 그때 접으면 콜드 종목이 시작도 못 하고 끝난다.
 */
export const STAGNANT_POLL_LIMIT = 6;

/**
 * 정체 판정을 시작하기 전에 반드시 지나야 하는 최소 폴 수.
 *
 * `enrichedCount > 0`만으로는 부족하다 — 그 조건은 이번 마운트의 진전이 아니라
 * **SSR 스냅샷에 이미 들어 있던 카드**로 충족된다. 그래서 예전엔 스피너 floor
 * (`REFRESH_SNAPSHOT_MIN_POLLS`)를 재사용해 t=15초에 접었는데, 이번 마운트가
 * 유발한 첫 카드가 도착하는 실측 구간은 그보다 뒤다: 적재 2~5초 + upsert 파동 +
 * 첫 LLM 왕복 4~13초 = 최악 22~30초. 즉 살아 있는 보강 라운드를 잘랐다
 * (감사: 비용 라운드 16이 계측으로 실증).
 *
 * 12틱 = 36초로 그 구간을 넘긴다. 상한은 100 → 12~16틱이라 절감(84~88%)은
 * 그대로 남는다. 스피너 floor는 UI 표시용이라 이 판정과 목적이 다르므로 분리한다.
 */
export const STAGNATION_FLOOR_POLLS = 12;

function hasPendingAnalysis(items: NewsDisplayItem[]): boolean {
    return items.some(
        item => item.sentiment === null || item.priceImpact === null
    );
}

export interface UseNewsCardPollingReturn {
    items: NewsDisplayItem[];
    isPolling: boolean;
    pollError: Error | null;
}

/**
 * Keeps the news card list up-to-date while background analysis is in progress.
 *
 * On mount, this hook polls `getNewsCardsAction` every 3 s and replaces the
 * local state with the fresh DB snapshot. Even when SSR already has analyzed
 * rows, the news page still runs a background FMP refresh, so the UI keeps a
 * short "checking latest news" state before treating the DB snapshot as final.
 *
 * `pollError` becomes non-null after `MAX_CONSECUTIVE_FAILURES` consecutive
 * polling errors so the consuming component can rethrow it for the surrounding
 * error boundary to catch.
 *
 * NOTE: `initialItems` is compared by reference for state-reset detection.
 * Callers must pass a stable reference (typically the SSR snapshot) — passing
 * a freshly-built array on every parent render will cause unnecessary state
 * resets mid-poll. If reference stability cannot be guaranteed, memoize at
 * the call site (`useMemo([initialItems])`) or remount with `key={symbol}`.
 */
export function useNewsCardPolling(
    symbol: string,
    initialItems: NewsDisplayItem[],
    onPollingComplete?: OnPollingComplete
): UseNewsCardPollingReturn {
    const [items, setItems] = useState(initialItems);
    const [isPolling, setIsPolling] = useState(true);
    const [pollError, setPollError] = useState<Error | null>(null);
    // Reset on symbol change in render (React-recommended "store information
    // from previous renders" pattern). Avoids the
    // `react-hooks/set-state-in-effect` warning and skips a redundant commit
    // cycle vs. doing the reset from inside an effect.
    // https://react.dev/reference/react/useState#storing-information-from-previous-renders
    //
    // Only `symbol` is compared. `initialItems` is intentionally NOT in the
    // reset key — array props in tests / unmemoized parents change identity on
    // every render, which would re-fire setState during render and cause an
    // infinite loop. Callers that need a state reset on a fresh `initialItems`
    // (e.g., new SSR snapshot for the same symbol) should remount with `key={...}`.
    const [prevSymbol, setPrevSymbol] = useState(symbol);
    const latestItemsRef = useRef(initialItems);
    // Keep the latest callback in a ref so the interval closure never goes stale.
    const onPollingCompleteRef = useRef(onPollingComplete);

    if (prevSymbol !== symbol) {
        setPrevSymbol(symbol);
        setItems(initialItems);
        setIsPolling(true);
        setPollError(null);
    }

    // Mirror committed `items` into the ref so the polling error handler can
    // read the latest snapshot without depending on stale closure values. Done
    // in useLayoutEffect (not in render) to satisfy the no-ref-mutation-during-
    // render rule while still landing before any concurrent reads from setInterval.
    useLayoutEffect(() => {
        latestItemsRef.current = items;
    }, [items]);

    useLayoutEffect(() => {
        onPollingCompleteRef.current = onPollingComplete;
    }, [onPollingComplete]);

    useEffect(() => {
        let pollCount = 0;
        let consecutiveFailures = 0;
        // 진전이 멈추면 선다.
        //
        // 종료 조건이 `!hasPendingAnalysis(fresh)` — 즉 창 안의 **모든** 카드가
        // 보강돼야 멈춘다 — 인데, 공급 쪽은 방문자 25건/10분(`VISITOR_NEWS_CARD_LIMIT`)
        // + 크론 12건/밤이고 창은 180일이다. 기사가 25건을 넘는 종목은 그 조건이
        // 구조적으로 참이 되지 않아 매 조회마다 100회 상한을 그대로 채운다. 게다가
        // 5회째에 스피너만 꺼져서(`setIsPolling(false)`) 나머지 95회는 눈에도 안
        // 보인다(감사: 비용 라운드 15).
        let enrichedCount = 0;
        let stagnantPolls = 0;
        const startTime = Date.now();
        // 언마운트 후 쓰기 방지 — `clearInterval`은 다음 tick만 막고, 이미 날아간
        // 요청의 응답은 그대로 돌아온다. `setItems`/`latestItemsRef`/
        // `onPollingComplete`가 전부 await 뒤에 있어 그대로 두면 떠난 종목의 카드로
        // 상태를 쓰고, `useNewsPollingWithInvalidation`을 통해 그 종목의
        // `invalidateQueries`까지 발화시킨다.
        //
        // 종목 전환 자체는 remount다(Next가 `[symbol]` 세그먼트를 param으로 keying).
        // 자세한 경위는 형제 훅 `useWaitForNewsCards` 주석 참조.
        let cancelled = false;

        const intervalId = setInterval(async () => {
            if (Date.now() - startTime > MAX_POLL_DURATION_MS) {
                setIsPolling(false);
                clearInterval(intervalId);
                if (latestItemsRef.current.length > 0) {
                    onPollingCompleteRef.current?.(latestItemsRef.current);
                }
                return;
            }

            try {
                const fresh = await getNewsCardsAction(symbol);
                if (cancelled) return;
                pollCount += 1;
                consecutiveFailures = 0;
                latestItemsRef.current = fresh;
                setItems(fresh);

                if (
                    fresh.length > 0 &&
                    pollCount >= REFRESH_SNAPSHOT_MIN_POLLS
                ) {
                    setIsPolling(false);
                }

                // 보강된 카드 수가 STAGNANT_POLL_LIMIT 틱 연속 그대로면, 남은
                // 미보강 카드는 이번 창에서 채워지지 않는다 — 상한까지 끌 이유가 없다.
                const freshEnriched = fresh.filter(
                    item => item.sentiment !== null
                ).length;
                if (freshEnriched > enrichedCount) {
                    enrichedCount = freshEnriched;
                    stagnantPolls = 0;
                } else {
                    stagnantPolls += 1;
                }

                if (
                    fresh.length === 0 &&
                    pollCount >= EMPTY_SNAPSHOT_MAX_POLLS
                ) {
                    setIsPolling(false);
                    clearInterval(intervalId);
                } else if (
                    // 보강이 **한 번이라도** 진행된 뒤에만 정체로 본다. 아직 0건이면
                    // 첫 카드가 도착하기 전(적재 + LLM 왕복)일 뿐이라 여기서 접으면
                    // 콜드 종목이 시작도 못 하고 끝난다 — 그 케이스는 wall-clock
                    // 상한이 맡는다.
                    enrichedCount > 0 &&
                    pollCount >= STAGNATION_FLOOR_POLLS &&
                    stagnantPolls >= STAGNANT_POLL_LIMIT
                ) {
                    setIsPolling(false);
                    clearInterval(intervalId);
                    if (fresh.length > 0) {
                        onPollingCompleteRef.current?.(fresh);
                    }
                } else if (
                    fresh.length > 0 &&
                    !hasPendingAnalysis(fresh) &&
                    pollCount >= REFRESH_SNAPSHOT_MIN_POLLS
                ) {
                    setIsPolling(false);
                    clearInterval(intervalId);
                    onPollingCompleteRef.current?.(fresh);
                }
            } catch (err) {
                if (cancelled) return;
                pollCount += 1;
                consecutiveFailures += 1;
                console.error('[useNewsCardPolling] poll failed:', err);

                if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                    setPollError(
                        err instanceof Error ? err : new Error(String(err))
                    );
                    setIsPolling(false);
                    clearInterval(intervalId);
                    return;
                }

                if (
                    pollCount >= EMPTY_SNAPSHOT_MAX_POLLS &&
                    !hasPendingAnalysis(latestItemsRef.current)
                ) {
                    setIsPolling(false);
                    clearInterval(intervalId);
                }
            }
        }, POLL_INTERVAL_MS);

        return () => {
            cancelled = true;
            clearInterval(intervalId);
        };
        // Only `symbol` is in deps. `initialItems` is excluded on purpose —
        // including it would restart the polling effect on every parent render
        // with an unstable array prop, resetting `pollCount` and breaking the
        // EMPTY_SNAPSHOT_MAX_POLLS / REFRESH_SNAPSHOT_MIN_POLLS thresholds.
        // The reset-on-symbol-change branch above handles the only legitimate
        // case where state needs to be cleared while the hook stays mounted.
    }, [symbol]);

    return { items, isPolling, pollError };
}
