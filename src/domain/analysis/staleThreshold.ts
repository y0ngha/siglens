import type { Timeframe } from '@y0ngha/siglens-core';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

const STALE_THRESHOLD_MS: Record<Timeframe, number> = {
    '5Min': 5 * MINUTE_MS,
    '15Min': 5 * MINUTE_MS,
    '30Min': 5 * MINUTE_MS,
    '1Hour': 30 * MINUTE_MS,
    '4Hour': 30 * MINUTE_MS,
    '1Day': 4 * HOUR_MS,
};

export function getStaleThresholdMs(timeframe: Timeframe): number {
    return STALE_THRESHOLD_MS[timeframe];
}

export function isAnalysisStale(
    analyzedAt: string,
    timeframe: Timeframe,
    now: Date = new Date()
): boolean {
    const analyzedTime = new Date(analyzedAt).getTime();
    if (Number.isNaN(analyzedTime)) return false;
    return now.getTime() - analyzedTime > STALE_THRESHOLD_MS[timeframe];
}
