'use client';

import { useState, useEffect, useRef } from 'react';
import type { MarketNewsCardItem } from '@/entities/market-news';
import type { NewsFeedCategory } from '@y0ngha/siglens-core';
import { POLL_INTERVAL_MS } from '../constants';
import { pollMarketNewsCardsStep } from '../utils/pollMarketNewsCardsStep';

export interface UseMarketNewsCardPollingReturn {
    items: MarketNewsCardItem[];
    isPolling: boolean;
    pollError: Error | null;
}

/**
 * Keeps the market-news card list up-to-date while background analysis is in
 * progress for a given feed category.
 *
 * Polls `getMarketNewsCardsAction(category)` every `POLL_INTERVAL_MS` and stops
 * when ALL items have `sentiment !== null` (fully enriched), after
 * `MAX_POLL_DURATION_MS`, after `MAX_CONSECUTIVE_FAILURES` consecutive polling
 * errors, or after `EMPTY_SNAPSHOT_MAX_POLLS` consecutive empty snapshots.
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

    // Keep a ref to the interval ID so the step helper can clear it without
    // capturing a stale closure value.
    const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);

    if (prevCategory !== category) {
        setPrevCategory(category);
        setItems(initialItems);
        setIsPolling(true);
        setPollError(null);
    }

    useEffect(() => {
        const stateRef = {
            pollCount: 0,
            consecutiveFailures: 0,
            startTime: Date.now(),
        };

        intervalIdRef.current = setInterval(() => {
            void pollMarketNewsCardsStep({
                category,
                incrementFailures: () => {
                    stateRef.consecutiveFailures += 1;
                },
                resetFailures: () => {
                    stateRef.consecutiveFailures = 0;
                },
                incrementPollCount: () => {
                    stateRef.pollCount += 1;
                },
                getStartTime: () => stateRef.startTime,
                getPollCount: () => stateRef.pollCount,
                getConsecutiveFailures: () => stateRef.consecutiveFailures,
                setItems,
                setIsPolling,
                setPollError,
                clearInterval: () => {
                    if (intervalIdRef.current !== null) {
                        clearInterval(intervalIdRef.current);
                        intervalIdRef.current = null;
                    }
                },
            });
        }, POLL_INTERVAL_MS);

        return () => {
            if (intervalIdRef.current !== null) {
                clearInterval(intervalIdRef.current);
                intervalIdRef.current = null;
            }
        };
        // Only `category` is in deps. `initialItems` is excluded on purpose —
        // including it would restart polling on every parent render with an
        // unstable array prop, resetting pollCount. The reset-on-category-change
        // branch above handles the only legitimate case for state clearing.
    }, [category]);

    return { items, isPolling, pollError };
}
