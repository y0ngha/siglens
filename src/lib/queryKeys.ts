import type { Timeframe } from '@/domain/types';

export const QUERY_KEYS = {
    bars: (symbol: string, timeframe: Timeframe) =>
        ['bars', symbol, timeframe] as const,
} as const;
