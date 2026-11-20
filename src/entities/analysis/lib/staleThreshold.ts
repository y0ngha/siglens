import {
    isRegularSessionOpen,
    type MarketSessionSpec,
    type Timeframe,
} from '@y0ngha/siglens-core';
import { MS_PER_MINUTE, MS_PER_HOUR } from '@/shared/config/time';
import { lastSessionCloseAtOrBefore } from '@/shared/lib/marketSessionDate';

/**
 * 타임프레임별 "오래됨" 임계값. 단기(5/15/30분봉)는 시세 변동이 빠르므로 일률 5분으로
 * 짧게 잡아 재분석을 빠르게 권유한다. 중기(1H/4H)는 30분, 장기(1D)는 4시간으로
 * 늘어난다 — 봉의 시간 스케일이 커질수록 stale 판정의 보수성을 늘린다.
 *
 * 이 임계값은 **정규장이 열려 있을 때(또는 24/7 시장)** 만 시계 기준으로 쓰인다. 장이 닫힌
 * 동안에는 새 봉이 생기지 않으므로 {@link isAnalysisStale}이 마감 시각으로 판정한다.
 */
export const STALE_THRESHOLD_MS: Record<Timeframe, number> = {
    '5Min': 5 * MS_PER_MINUTE,
    '15Min': 5 * MS_PER_MINUTE,
    '30Min': 5 * MS_PER_MINUTE,
    '1Hour': 30 * MS_PER_MINUTE,
    '4Hour': 30 * MS_PER_MINUTE,
    '1Day': 4 * MS_PER_HOUR,
};

/**
 * 분석이 "오래됐는지" 본다. `analyzedAt`을 파싱할 수 없으면 오래된 것으로 치지 않는다.
 *
 * 원칙: 분석이 본 것보다 새로운 봉을 시장이 만들 수 있었을 때만 오래된 것이다. 이것은
 * 화면 힌트일 뿐이며 서버 캐시·재분석 쿨다운과 무관하다.
 *
 * `session`이 없거나 24/7 시장(크립토)이면 시계 임계값만 쓴다. 정규 세션이 있는 시장은:
 * - 일봉: 분석 뒤 정규장이 한 번이라도 마감했거나(새 일봉 완성), 장이 열려 있고 임계값을
 *   넘겼을 때. 마감 뒤 저녁·주말·휴장일에는 새 봉이 없으므로 오래되지 않았다.
 * - 분·시간봉: 장이 열려 있으면 시계 임계값, 닫혀 있으면 분석이 마지막 마감 이전일 때만.
 */
export function isAnalysisStale(
    analyzedAt: string,
    timeframe: Timeframe,
    now: Date,
    session?: MarketSessionSpec
): boolean {
    const analyzedTime = new Date(analyzedAt).getTime();
    if (Number.isNaN(analyzedTime)) return false;
    const clockStale =
        now.getTime() - analyzedTime > STALE_THRESHOLD_MS[timeframe];
    if (session === undefined || session.kind === 'always-open') {
        return clockStale;
    }

    const lastClose = lastSessionCloseAtOrBefore(session, now);
    const closedSinceAnalysis =
        lastClose !== null && analyzedTime < lastClose.getTime();
    const isOpen = isRegularSessionOpen(session, now);

    if (timeframe === '1Day')
        return closedSinceAnalysis || (isOpen && clockStale);
    return isOpen ? clockStale : closedSinceAnalysis;
}
