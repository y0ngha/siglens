import type { FearGreedHistoryPoint } from '@y0ngha/siglens-core';
import type { LineData, Time } from 'lightweight-charts';
import { FEAR_GREED_SESSIONS_PER_YEAR } from '@/entities/market-fear-greed/lib/buildMarketFearGreedComparisons';

/**
 * 마지막 1년의 점수 선 데이터. 서버는 "1년 전" 비교 게이지 때문에 약 2년을 보내므로 차트
 * 제목("최근 1년")에 맞춰 "1년 전" 비교 게이지와 같은 세션 수로 잘라 그린다. 워밍업 구간(`score === null`)은 빼서 선에 틈이 생긴다.
 */
export function toLineData(
    history: readonly FearGreedHistoryPoint[]
): LineData[] {
    return history
        .slice(-FEAR_GREED_SESSIONS_PER_YEAR)
        .filter(
            (p): p is FearGreedHistoryPoint & { score: number } =>
                p.score !== null
        )
        .map(p => ({
            // FearGreedHistoryPoint.date는 항상 'YYYY-MM-DD' — lightweight-charts Time(string) 계약을 만족한다.
            time: p.date as Time,
            value: p.score,
        }));
}
