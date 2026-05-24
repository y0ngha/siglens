'use client';

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { getNewsCardsAction } from '@/entities/news-article/actions';
import type { NewsDisplayItem } from '@/shared/lib/types';
import { MS_PER_MINUTE } from '@/shared/config/time';
import {
    POLL_INTERVAL_MS,
    MAX_CONSECUTIVE_FAILURES,
} from '../constants';

/**
 * Called once when polling terminates normally (all cards enriched, or timeout
 * with at least some cards present). Receives the final card snapshot so the
 * caller can decide whether any meaningful change occurred. Not called when
 * polling ends due to an empty news list or consecutive errors.
 */
export type OnPollingComplete = (finalItems: NewsDisplayItem[]) => void;

export { POLL_INTERVAL_MS, MAX_CONSECUTIVE_FAILURES };

export const EMPTY_SNAPSHOT_MAX_POLLS = 20;
const REFRESH_SNAPSHOT_MIN_POLLS = 5;
/**
 * Hard ceiling on overall polling duration. Even if a worker keeps returning
 * pending cards, we never poll beyond 5 minutes to avoid unbounded background
 * work in long-lived tabs.
 */
export const MAX_POLL_DURATION_MS = 5 * MS_PER_MINUTE;

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
        const startTime = Date.now();

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

                if (
                    fresh.length === 0 &&
                    pollCount >= EMPTY_SNAPSHOT_MAX_POLLS
                ) {
                    setIsPolling(false);
                    clearInterval(intervalId);
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

        return () => clearInterval(intervalId);
        // Only `symbol` is in deps. `initialItems` is excluded on purpose —
        // including it would restart the polling effect on every parent render
        // with an unstable array prop, resetting `pollCount` and breaking the
        // EMPTY_SNAPSHOT_MAX_POLLS / REFRESH_SNAPSHOT_MIN_POLLS thresholds.
        // The reset-on-symbol-change branch above handles the only legitimate
        // case where state needs to be cleared while the hook stays mounted.
    }, [symbol]);

    return { items, isPolling, pollError };
}
