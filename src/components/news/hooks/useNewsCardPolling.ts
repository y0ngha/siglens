'use client';

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { getNewsCardsAction } from '@/infrastructure/market/getNewsCardsAction';
import type { NewsDisplayItem } from '@/domain/types';

const POLL_INTERVAL_MS = 3_000;
const EMPTY_SNAPSHOT_MAX_POLLS = 20;
const REFRESH_SNAPSHOT_MIN_POLLS = 5;
/**
 * Hard ceiling on overall polling duration. Even if a worker keeps returning
 * pending cards, we never poll beyond 5 minutes to avoid unbounded background
 * work in long-lived tabs.
 */
const MAX_POLL_DURATION_MS = 5 * 60_000;
/**
 * Number of consecutive `getNewsCardsAction` failures before we surface the
 * error to the React error boundary via `pollError`.
 */
const MAX_CONSECUTIVE_FAILURES = 3;

function hasPendingAnalysis(items: NewsDisplayItem[]): boolean {
    return items.some(
        item => item.sentiment === null || item.priceImpact === null
    );
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
 */
export function useNewsCardPolling(
    symbol: string,
    initialItems: NewsDisplayItem[]
): {
    items: NewsDisplayItem[];
    isPolling: boolean;
    pollError: Error | null;
} {
    const [items, setItems] = useState(initialItems);
    const [isPolling, setIsPolling] = useState(true);
    const [pollError, setPollError] = useState<Error | null>(null);
    // Track the deps that should trigger a state reset. Comparing in render and
    // calling setState during render is the React-recommended pattern for
    // "store information from previous renders" — it avoids the
    // `react-hooks/set-state-in-effect` lint error and the cascading-render
    // cost of resetting state from inside an effect.
    // https://react.dev/reference/react/useState#storing-information-from-previous-renders
    const [prevSymbol, setPrevSymbol] = useState(symbol);
    const [prevInitialItems, setPrevInitialItems] = useState(initialItems);
    const latestItemsRef = useRef(initialItems);

    if (prevSymbol !== symbol || prevInitialItems !== initialItems) {
        setPrevSymbol(symbol);
        setPrevInitialItems(initialItems);
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

    useEffect(() => {
        let pollCount = 0;
        let consecutiveFailures = 0;
        const startTime = Date.now();

        const intervalId = setInterval(async () => {
            if (Date.now() - startTime > MAX_POLL_DURATION_MS) {
                setIsPolling(false);
                clearInterval(intervalId);
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
                    (fresh.length === 0 &&
                        pollCount >= EMPTY_SNAPSHOT_MAX_POLLS) ||
                    (fresh.length > 0 &&
                        !hasPendingAnalysis(fresh) &&
                        pollCount >= REFRESH_SNAPSHOT_MIN_POLLS)
                ) {
                    setIsPolling(false);
                    clearInterval(intervalId);
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
    }, [symbol, initialItems]);

    return { items, isPolling, pollError };
}
