'use client';

import { useState, useEffect } from 'react';
import { getNewsCardsAction } from '@/infrastructure/market/getNewsCardsAction';
import type { NewsDisplayItem } from '@/domain/types';

const POLL_INTERVAL_MS = 3_000;

function hasPendingAnalysis(items: NewsDisplayItem[]): boolean {
    return items.some(
        item => item.sentiment === null || item.priceImpact === null
    );
}

/**
 * Keeps the news card list up-to-date while background analysis is in progress.
 *
 * On mount, if any of the `initialItems` have not been AI-analyzed yet
 * (null sentiment / priceImpact), this hook polls `getNewsCardsAction`
 * every 3 s and replaces the local state with the fresh DB snapshot.
 * Polling stops automatically once all visible items are enriched.
 */
export function useNewsCardPolling(
    symbol: string,
    initialItems: NewsDisplayItem[]
): NewsDisplayItem[] {
    const [items, setItems] = useState(initialItems);

    useEffect(() => {
        if (!hasPendingAnalysis(initialItems)) return;

        const intervalId = setInterval(async () => {
            try {
                const fresh = await getNewsCardsAction(symbol);
                setItems(fresh);
                if (!hasPendingAnalysis(fresh)) {
                    clearInterval(intervalId);
                }
            } catch (err) {
                console.error('[useNewsCardPolling] poll failed:', err);
            }
        }, POLL_INTERVAL_MS);

        return () => clearInterval(intervalId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return items;
}
