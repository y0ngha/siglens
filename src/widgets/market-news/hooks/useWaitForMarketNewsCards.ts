'use client';

import { useState, useEffect, useRef } from 'react';
import type { NewsFeedCategory } from '@y0ngha/siglens-core';
import { POLL_INTERVAL_MS } from '../constants';
import { waitForMarketNewsCardsStep } from '../utils/waitForMarketNewsCardsStep';

export interface WaitForMarketNewsCardsResult {
    isReady: boolean;
    waitError: Error | null;
}

/**
 * Poll `getMarketNewsCardsAction` until at least one enriched card (sentiment
 * !== null) is available, then resolve. Returns `isReady = true` immediately
 * if `initiallyReady` is true.
 *
 * Adapted for market-news categories (keyed by sentinel symbol).
 */
export function useWaitForMarketNewsCards(
    category: NewsFeedCategory,
    initiallyReady: boolean
): WaitForMarketNewsCardsResult {
    const [isReady, setIsReady] = useState(initiallyReady);
    const [waitError, setWaitError] = useState<Error | null>(null);
    const [prevCategory, setPrevCategory] = useState(category);
    const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);

    if (prevCategory !== category) {
        setPrevCategory(category);
        setIsReady(initiallyReady);
        setWaitError(null);
    }

    useEffect(() => {
        if (initiallyReady) return;

        const stateRef = { consecutiveFailures: 0 };

        intervalIdRef.current = setInterval(() => {
            void waitForMarketNewsCardsStep({
                category,
                incrementFailures: () => {
                    stateRef.consecutiveFailures += 1;
                },
                resetFailures: () => {
                    stateRef.consecutiveFailures = 0;
                },
                getConsecutiveFailures: () => stateRef.consecutiveFailures,
                setIsReady,
                setWaitError,
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
    }, [category, initiallyReady]);

    return { isReady, waitError };
}
