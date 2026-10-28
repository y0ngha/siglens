import type { FearGreedHistoryPoint } from '@y0ngha/siglens-core';
import type { LineData, Time } from 'lightweight-charts';
import { FEAR_GREED_SESSIONS_PER_YEAR } from '@/entities/market-fear-greed/lib/buildMarketFearGreedComparisons';

/**
 * 마지막 1년의 점수 선 데이터. 서버는 "1년 전" 비교 게이지 때문에 약 2년을 보내므로 차트
 * 제목("최근 1년")에 맞춰 잘라 그린다.
 *
 * 워밍업 구간(`score === null`)을 먼저 빼고 자른다. "1년 전" 비교 게이지도 점수가 있는
 * 세션만 세어 거슬러 올라가므로, 같은 순서로 세야 이력이 짧을 때도 두 기준이 같은 세션
 * 수를 가리킨다.
 */
export function toLineData(
    history: readonly FearGreedHistoryPoint[]
): LineData[] {
    return history
        .filter(
            (p): p is FearGreedHistoryPoint & { score: number } =>
                p.score !== null
        )
        .slice(-FEAR_GREED_SESSIONS_PER_YEAR)
        .map(p => ({
            // FearGreedHistoryPoint.date는 항상 'YYYY-MM-DD' — lightweight-charts Time(string) 계약을 만족한다.
            time: p.date as Time,
            value: p.score,
        }));
}
