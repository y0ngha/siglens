'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { NewsDisplayItem } from '@/shared/lib/types';
import {
    useNewsCardPolling,
    type OnPollingComplete,
    type UseNewsCardPollingReturn,
} from '@/components/news/hooks/useNewsCardPolling';
import { QUERY_KEYS } from '@/shared/config/queryConfig';

function isPendingAnalysis(item: NewsDisplayItem): boolean {
    return item.sentiment === null || item.priceImpact === null;
}

function countEnriched(items: NewsDisplayItem[]): number {
    return items.filter(item => !isPendingAnalysis(item)).length;
}

/**
 * Wraps `useNewsCardPolling` with React Query cache invalidation. When polling
 * completes and the final enriched card count exceeds the baseline captured at
 * mount, invalidates `newsAnalysis` queries for the symbol so the aggregate AI
 * analysis reflects all newly fetched articles.
 *
 * Extracts the cache-invalidation decision out of the presentation layer so
 * `NewsList` stays focused on rendering.
 */
export function useNewsPollingWithInvalidation(
    symbol: string,
    initialItems: NewsDisplayItem[]
): UseNewsCardPollingReturn {
    const queryClient = useQueryClient();
    // Stored as state (not a ref) so the symbol-change reset below can use
    // setState during render without triggering the react-hooks/refs lint rule.
    const [initialEnrichedCount, setInitialEnrichedCount] = useState(() =>
        countEnriched(initialItems)
    );
    const [prevSymbol, setPrevSymbol] = useState(symbol);
    // Stable holder so useNewsCardPolling (data-fetch hook) is declared before
    // useCallback per MISTAKES.md #17. Kept current via useLayoutEffect below.
    const onCompleteRef = useRef<OnPollingComplete | undefined>(undefined);

    // Reset baseline on symbol change — React "store information from previous
    // renders" pattern.
    if (prevSymbol !== symbol) {
        setPrevSymbol(symbol);
        setInitialEnrichedCount(countEnriched(initialItems));
    }

    const result = useNewsCardPolling(
        symbol,
        initialItems,
        (finalItems: NewsDisplayItem[]) => onCompleteRef.current?.(finalItems)
    );

    const handlePollingComplete = useCallback(
        (finalItems: NewsDisplayItem[]) => {
            if (countEnriched(finalItems) > initialEnrichedCount) {
                void queryClient.invalidateQueries({
                    queryKey: QUERY_KEYS.newsAnalysisPrefix(symbol),
                });
            }
        },
        [queryClient, symbol, initialEnrichedCount]
    );

    useLayoutEffect(() => {
        onCompleteRef.current = handlePollingComplete;
    }, [handlePollingComplete]);

    return result;
}
