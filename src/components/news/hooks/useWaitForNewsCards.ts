'use client';

import { useState, useEffect } from 'react';
import { getNewsCardsAction } from '@/infrastructure/market/getNewsCardsAction';
import type { NewsDisplayItem } from '@/domain/types';

const POLL_INTERVAL_MS = 3_000;
/**
 * Number of consecutive `getNewsCardsAction` failures before we surface the
 * error to the surrounding error boundary via `pollError`.
 */
const MAX_CONSECUTIVE_FAILURES = 3;

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

        const intervalId = setInterval(async () => {
            try {
                const fresh = await getNewsCardsAction(symbol);
                consecutiveFailures = 0;
                if (hasAnyEnrichedCard(fresh)) {
                    setIsReady(true);
                    clearInterval(intervalId);
                }
            } catch (err) {
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

        return () => clearInterval(intervalId);
    }, [symbol, initiallyReady]);

    return { isReady, pollError };
}
