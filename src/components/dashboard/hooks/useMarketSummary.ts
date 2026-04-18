'use client';

import { useQuery } from '@tanstack/react-query';
import { getMarketSummaryAction } from '@/infrastructure/dashboard/getMarketSummaryAction';
import { QUERY_KEYS, MARKET_SUMMARY_STALE_TIME_MS } from '@/lib/queryConfig';

export function useMarketSummary() {
    return useQuery({
        queryKey: QUERY_KEYS.marketSummary(),
        queryFn: getMarketSummaryAction,
        staleTime: MARKET_SUMMARY_STALE_TIME_MS,
    });
}
