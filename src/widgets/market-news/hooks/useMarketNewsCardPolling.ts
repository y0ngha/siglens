'use client';

import { useState, useEffect } from 'react';
import { getMarketNewsCardsAction } from '@/entities/market-news/actions';
import type { MarketNewsCardItem } from '@/entities/market-news/actions';
import type { NewsFeedCategory } from '@y0ngha/siglens-core';
import {
    POLL_INTERVAL_MS,
    MAX_CONSECUTIVE_FAILURES,
    EMPTY_SNAPSHOT_MAX_POLLS,
    MAX_POLL_DURATION_MS,
} from '../constants';

function hasPendingAnalysis(items: MarketNewsCardItem[]): boolean {
    return items.some(
        item => item.sentiment === null || item.priceImpact === null
    );
}

export interface UseMarketNewsCardPollingReturn {
    items: MarketNewsCardItem[];
    isPolling: boolean;
    pollError: Error | null;
}

/**
 * Keeps the market-news card list up-to-date while background analysis is in
 * progress for a given feed category.
 *
 * Polls `getMarketNewsCardsAction(category)` every 3 s and stops when ALL
 * items have `sentiment !== null` (fully enriched), after `MAX_POLL_DURATION_MS`
 * (5-minute hard ceiling), after `MAX_CONSECUTIVE_FAILURES` (3) consecutive
 * polling errors, or after `EMPTY_SNAPSHOT_MAX_POLLS` (20) consecutive empty
 * snapshots.
 *
 * Pass a stable `key` on the consuming list to force a fresh-mount reset
 * when the snapshot array identity must drive a reset (e.g. client navigation).
 */
export function useMarketNewsCardPolling(
    category: NewsFeedCategory,
    initialItems: MarketNewsCardItem[]
): UseMarketNewsCardPollingReturn {
    const [items, setItems] = useState(initialItems);
    const [isPolling, setIsPolling] = useState(true);
    const [pollError, setPollError] = useState<Error | null>(null);

    // Reset on category change in render (React-recommended "store information
    // from previous renders" pattern). Avoids the react-hooks/set-state-in-effect
    // warning and skips a redundant commit cycle.
    // https://react.dev/reference/react/useState#storing-information-from-previous-renders
    const [prevCategory, setPrevCategory] = useState(category);

    if (prevCategory !== category) {
        setPrevCategory(category);
        setItems(initialItems);
        setIsPolling(true);
        setPollError(null);
    }

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
                const fresh = await getMarketNewsCardsAction(category);
                pollCount += 1;
                consecutiveFailures = 0;
                setItems(fresh);

                if (
                    fresh.length === 0 &&
                    pollCount >= EMPTY_SNAPSHOT_MAX_POLLS
                ) {
                    setIsPolling(false);
                    clearInterval(intervalId);
                } else if (fresh.length > 0 && !hasPendingAnalysis(fresh)) {
                    // All cards are enriched — no need to keep polling.
                    setIsPolling(false);
                    clearInterval(intervalId);
                }
            } catch (err) {
                pollCount += 1;
                consecutiveFailures += 1;
                console.error('[useMarketNewsCardPolling] poll failed:', err);

                if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                    setPollError(
                        err instanceof Error ? err : new Error(String(err))
                    );
                    setIsPolling(false);
                    clearInterval(intervalId);
                }
            }
        }, POLL_INTERVAL_MS);

        return () => clearInterval(intervalId);
        // Only `category` is in deps. `initialItems` is excluded on purpose —
        // including it would restart polling on every parent render with an
        // unstable array prop, resetting pollCount. The reset-on-category-change
        // branch above handles the only legitimate case for state clearing.
    }, [category]);

    return { items, isPolling, pollError };
}
