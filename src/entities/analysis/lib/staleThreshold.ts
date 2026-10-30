import type { Timeframe } from '@y0ngha/siglens-core';
import { MS_PER_MINUTE, MS_PER_HOUR } from '@/shared/config/time';

/**
 * 타임프레임별 "오래됨" 임계값. 단기(5/15/30분봉)는 시세 변동이 빠르므로 일률 5분으로
 * 짧게 잡아 재분석을 빠르게 권유한다. 중기(1H/4H)는 30분, 장기(1D)는 4시간으로
 * 늘어난다 — 봉의 시간 스케일이 커질수록 stale 판정의 보수성을 늘린다.
 */
export const STALE_THRESHOLD_MS: Record<Timeframe, number> = {
    '5Min': 5 * MS_PER_MINUTE,
    '15Min': 5 * MS_PER_MINUTE,
    '30Min': 5 * MS_PER_MINUTE,
    '1Hour': 30 * MS_PER_MINUTE,
    '4Hour': 30 * MS_PER_MINUTE,
    '1Day': 4 * MS_PER_HOUR,
};

/** 분석이 임계값보다 오래됐는지 본다. `analyzedAt`을 파싱할 수 없으면 오래된 것으로 치지 않는다. */
export function isAnalysisStale(
    analyzedAt: string,
    timeframe: Timeframe,
    now: Date
): boolean {
    const analyzedTime = new Date(analyzedAt).getTime();
    if (Number.isNaN(analyzedTime)) return false;
    return now.getTime() - analyzedTime > STALE_THRESHOLD_MS[timeframe];
}
