'use client';

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/lib/queryConfig';
import { getOptionsChainAction } from '@/infrastructure/options/optionsActions';
import type { OptionsChain } from '@y0ngha/siglens-core';

/**
 * React Query hook that fetches a single expiration's options chain on demand.
 *
 * Keeps each expiration in its own cache entry (`optionsChain(symbol, expiry)`)
 * so switching between expiration chips only re-fetches the selected one, not
 * the entire snapshot. staleTime mirrors the market-open `cacheLife` revalidation
 * window on the server (5 minutes).
 */
export function useOptionsChain(symbol: string, expirationDate: string) {
    return useQuery<OptionsChain | null>({
        queryKey: QUERY_KEYS.optionsChain(symbol, expirationDate),
        queryFn: () => getOptionsChainAction(symbol, expirationDate),
        retry: 2,
        staleTime: 5 * 60 * 1000, // 5 min — mirrors server-side options-market-open cacheLife stale
    });
}
