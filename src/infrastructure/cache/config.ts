import type { Timeframe } from '@/domain/types';

export const ANALYSIS_CACHE_TTL: Record<Timeframe, number> = {
    '1Min': 300,
    '5Min': 900,
    '15Min': 1800,
    '1Hour': 3600,
    '1Day': 86400,
};

export function buildAnalysisCacheKey(
    symbol: string,
    timeframe: Timeframe
): string {
    return `analysis:${symbol}:${timeframe}`;
}
