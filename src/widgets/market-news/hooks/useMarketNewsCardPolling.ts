'use client';

import { useState, useEffect, useRef } from 'react';
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

interface PollMarketNewsCardsContext {
    category: NewsFeedCategory;
    state: {
        pollCount: number;
        consecutiveFailures: number;
        startTime: number;
    };
    setItems: (next: MarketNewsCardItem[]) => void;
    setIsPolling: (next: boolean) => void;
    setPollError: (next: Error | null) => void;
    clearInterval: () => void;
}

/** One polling tick. Pure function of the explicit context object — no closure capture, unit-testable. */
async function pollMarketNewsCardsStep(
    ctx: PollMarketNewsCardsContext
): Promise<'continue' | 'stop'> {
    if (Date.now() - ctx.state.startTime > MAX_POLL_DURATION_MS) {
        ctx.setIsPolling(false);
        ctx.clearInterval();
        return 'stop';
    }

    try {
        const fresh = await getMarketNewsCardsAction(ctx.category);
        ctx.state.pollCount += 1;
        ctx.state.consecutiveFailures = 0;
        ctx.setItems(fresh);

        if (
            fresh.length === 0 &&
            ctx.state.pollCount >= EMPTY_SNAPSHOT_MAX_POLLS
        ) {
            ctx.setIsPolling(false);
            ctx.clearInterval();
            return 'stop';
        } else if (fresh.length > 0 && !hasPendingAnalysis(fresh)) {
            // All cards are enriched — no need to keep polling.
            ctx.setIsPolling(false);
            ctx.clearInterval();
            return 'stop';
        }
    } catch (err) {
        ctx.state.pollCount += 1;
        ctx.state.consecutiveFailures += 1;
        console.error('[useMarketNewsCardPolling] poll failed:', err);

        if (ctx.state.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            ctx.setPollError(
                err instanceof Error ? err : new Error(String(err))
            );
            ctx.setIsPolling(false);
            ctx.clearInterval();
            return 'stop';
        }
    }

    return 'continue';
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
        const state = {
            pollCount: 0,
            consecutiveFailures: 0,
            startTime: Date.now(),
        };

        intervalIdRef.current = setInterval(() => {
            void pollMarketNewsCardsStep({
                category,
                state,
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
