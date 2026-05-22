import type { Timeframe } from '@y0ngha/siglens-core';
import { MS_PER_MINUTE, MS_PER_HOUR } from '@/domain/constants/time';

// 단기 타임프레임(5/15/30분봉)은 시세 변동이 빠르므로 임계값을 일률 5분으로
// 짧게 잡아 사용자에게 재분석을 빠르게 권유한다. 중기(1H/4H)는 30분, 장기(1D)는
// 4시간으로 늘어난다 — 봉의 시간 스케일이 커질수록 stale 판정의 보수성을 늘린다.
export const STALE_THRESHOLD_MS: Record<Timeframe, number> = {
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
    now: Date
): boolean {
    const analyzedTime = new Date(analyzedAt).getTime();
    if (Number.isNaN(analyzedTime)) return false;
    return now.getTime() - analyzedTime > STALE_THRESHOLD_MS[timeframe];
}
