import type { Timeframe } from '@/domain/types';

export const QUERY_STALE_TIME_MS = 60 * 1000;
export const QUERY_GC_TIME_MS = 5 * 60 * 1000;

export const QUERY_KEYS = {
    bars: (symbol: string, timeframe: Timeframe) =>
        ['bars', symbol, timeframe] as const,
    tickerSearch: (query: string) => ['ticker-search', query] as const,
    assetInfo: (symbol: string) => ['asset-info', symbol] as const,
} as const;
