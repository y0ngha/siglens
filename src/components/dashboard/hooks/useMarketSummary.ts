'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
    MarketIndexData,
    MarketSectorData,
    MarketSummaryActionResult,
} from '@/domain/types';
import { getMarketSummaryAction } from '@/infrastructure/dashboard/getMarketSummaryAction';
import { MARKET_SUMMARY_STALE_TIME_MS, QUERY_KEYS } from '@/lib/queryConfig';

interface UseMarketSummaryReturn {
    data: MarketSummaryActionResult | undefined;
    isPending: boolean;
    sectorMap: Map<string, MarketSectorData>;
    indices: readonly MarketIndexData[];
}

export function useMarketSummary(): UseMarketSummaryReturn {
    const { data, isPending } = useQuery({
        queryKey: QUERY_KEYS.marketSummary(),
        queryFn: getMarketSummaryAction,
        staleTime: MARKET_SUMMARY_STALE_TIME_MS,
    });

    const sectorMap = useMemo(
        () =>
            new Map<string, MarketSectorData>(
                (data?.summary.sectors ?? []).map(s => [s.symbol, s])
            ),
        [data?.summary.sectors]
    );

    const indices = useMemo(
        () => data?.summary.indices ?? [],
        [data?.summary.indices]
    );

    return { data, isPending, sectorMap, indices };
}
