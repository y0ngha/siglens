import type { FearGreedHistoryPoint } from '@y0ngha/siglens-core';
import { FEAR_GREED_SESSIONS_PER_YEAR } from '@/entities/market-fear-greed/lib/buildMarketFearGreedComparisons';
import { toLineData } from '../../utils/toLineData';

function point(i: number, score: number | null): FearGreedHistoryPoint {
    return {
        date: new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10),
        score,
        label: score === null ? null : 'NEUTRAL',
    };
}

describe('toLineData', () => {
    it('워밍업(null) 점을 건너뛴다', () => {
        const data = toLineData([point(0, null), point(1, 40), point(2, 55)]);
        expect(data).toEqual([
            { time: '2024-01-02', value: 40 },
            { time: '2024-01-03', value: 55 },
        ]);
    });

    it('마지막 FEAR_GREED_SESSIONS_PER_YEAR개만 그린다', () => {
        const history = Array.from(
            { length: FEAR_GREED_SESSIONS_PER_YEAR + 5 },
            (_, i) => point(i, 50)
        );
        const data = toLineData(history);
        expect(data).toHaveLength(FEAR_GREED_SESSIONS_PER_YEAR);
        expect(data[0].time).toBe(history[5].date);
    });

    it('빈 history는 빈 배열이다', () => {
        expect(toLineData([])).toEqual([]);
    });
});
