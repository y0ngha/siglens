'use client';

import { useState, useEffect } from 'react';
import { getNewsCardsAction } from '@/infrastructure/market/getNewsCardsAction';
import type { NewsDisplayItem } from '@/domain/types';

const POLL_INTERVAL_MS = 3_000;

function hasAnyEnrichedCard(items: NewsDisplayItem[]): boolean {
    return items.some(item => item.sentiment !== null);
}

/**
 * Returns `true` when at least one enriched news card (with AI analysis) is
 * available in the DB for `symbol`.
 *
 * If `initiallyReady` is already `true` (the SSR snapshot contained enriched
 * cards), this resolves immediately without any polling.
 *
 * Otherwise, polls `getNewsCardsAction` every 3 s until an enriched card
 * appears — at which point the AI aggregate analysis can safely be triggered.
 */
export function useWaitForNewsCards(
    symbol: string,
    initiallyReady: boolean
): boolean {
    const [isReady, setIsReady] = useState(initiallyReady);

    useEffect(() => {
        if (initiallyReady) return;

        const intervalId = setInterval(async () => {
            try {
                const fresh = await getNewsCardsAction(symbol);
                if (hasAnyEnrichedCard(fresh)) {
                    setIsReady(true);
                    clearInterval(intervalId);
                }
            } catch (err) {
                console.error('[useWaitForNewsCards] poll failed:', err);
            }
        }, POLL_INTERVAL_MS);

        return () => clearInterval(intervalId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return isReady;
}
