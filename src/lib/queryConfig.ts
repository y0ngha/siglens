import type { Timeframe } from '@/domain/types';
import { MS_PER_MINUTE } from '@/domain/constants/time';

export const QUERY_STALE_TIME_MS = MS_PER_MINUTE;
export const QUERY_GC_TIME_MS = 5 * MS_PER_MINUTE;

export const QUERY_KEYS = {
    bars: (symbol: string, timeframe: Timeframe) =>
        ['bars', symbol, timeframe] as const,
    tickerSearch: (query: string) => ['ticker-search', query] as const,
    assetInfo: (symbol: string) => ['asset-info', symbol] as const,
} as const;
