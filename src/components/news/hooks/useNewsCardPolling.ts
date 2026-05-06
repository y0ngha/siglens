'use client';

import { useState, useEffect, useRef } from 'react';
import { getNewsCardsAction } from '@/infrastructure/market/getNewsCardsAction';
import type { NewsDisplayItem } from '@/domain/types';

const POLL_INTERVAL_MS = 3_000;
const EMPTY_SNAPSHOT_MAX_POLLS = 20;
const REFRESH_SNAPSHOT_MIN_POLLS = 5;

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
 */
export function useNewsCardPolling(
    symbol: string,
    initialItems: NewsDisplayItem[]
): { items: NewsDisplayItem[]; isPolling: boolean } {
    const [items, setItems] = useState(initialItems);
    const [isPolling, setIsPolling] = useState(true);
    const latestItemsRef = useRef(initialItems);

    useEffect(() => {
        let pollCount = 0;

        const intervalId = setInterval(async () => {
            try {
                const fresh = await getNewsCardsAction(symbol);
                pollCount += 1;
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
                console.error('[useNewsCardPolling] poll failed:', err);
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { items, isPolling };
}
