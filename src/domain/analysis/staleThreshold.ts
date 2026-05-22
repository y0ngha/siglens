import type { Timeframe } from '@y0ngha/siglens-core';
import { MS_PER_MINUTE, MS_PER_HOUR } from '@/domain/constants/time';

const STALE_THRESHOLD_MS: Record<Timeframe, number> = {
    '5Min': 5 * MS_PER_MINUTE,
    '15Min': 5 * MS_PER_MINUTE,
    '30Min': 5 * MS_PER_MINUTE,
    '1Hour': 30 * MS_PER_MINUTE,
    '4Hour': 30 * MS_PER_MINUTE,
    '1Day': 4 * MS_PER_HOUR,
};

export function isAnalysisStale(
    analyzedAt: string,
    timeframe: Timeframe,
    now: Date = new Date()
): boolean {
    const analyzedTime = new Date(analyzedAt).getTime();
    if (Number.isNaN(analyzedTime)) return false;
    return now.getTime() - analyzedTime > STALE_THRESHOLD_MS[timeframe];
}
