import type { Timeframe } from '@/domain/types';

export const ANALYSIS_CACHE_TTL: Record<Timeframe, number> = {
    '1Min': 60,
    '5Min': 5 * 60,
    '15Min': 15 * 60,
    '1Hour': 60 * 60,
    '1Day': 24 * 60 * 60,
};

export function buildAnalysisCacheKey(
    symbol: string,
    timeframe: Timeframe
): string {
    return `analysis:${symbol}:${timeframe}`;
}
