import type { FearGreedHistoryPoint } from '@y0ngha/siglens-core';
import { FEAR_GREED_SESSIONS_PER_YEAR } from '@/entities/market-fear-greed/lib/buildMarketFearGreedComparisons';
import { MS_PER_DAY } from '@/shared/config/time';
import { chartWindow } from '../../utils/chartWindow';

/** `count`개의 점을 `stepDays`일 간격으로 만든다. 마지막 점이 가장 최근. */
function series(count: number, stepDays: number): FearGreedHistoryPoint[] {
    const start = Date.UTC(2025, 0, 1);
    return Array.from({ length: count }, (_, i) => ({
        date: new Date(start + i * stepDays * MS_PER_DAY)
            .toISOString()
            .slice(0, 10),
        score: 50,
        label: 'NEUTRAL' as const,
    }));
}

describe('chartWindow', () => {
    it('거래일 기준 252점(주식, 주 5일)은 1년이다', () => {
        // 252세션 ≈ 365일: 5/7 비율로 달력일이 늘어난다.
        const start = Date.UTC(2025, 0, 1);
        const stock = Array.from(
            { length: FEAR_GREED_SESSIONS_PER_YEAR },
            (_, i) => ({
                date: new Date(start + Math.round((i * 7) / 5) * MS_PER_DAY)
                    .toISOString()
                    .slice(0, 10),
                score: 50,
                label: 'NEUTRAL' as const,
            })
        );
        expect(chartWindow(stock)).toEqual({ kind: 'year' });
    });

    it('매일 쌓이는 암호화폐 252점은 약 8개월이다', () => {
        expect(chartWindow(series(FEAR_GREED_SESSIONS_PER_YEAR, 1))).toEqual({
            kind: 'months',
            months: 8,
        });
    });

    it('이력이 길어도 차트가 그리는 마지막 252점으로만 잰다', () => {
        expect(chartWindow(series(600, 1))).toEqual({
            kind: 'months',
            months: 8,
        });
    });

    it('이력이 짧으면 그 기간만큼의 개월 수다', () => {
        expect(chartWindow(series(91, 1))).toEqual({
            kind: 'months',
            months: 3,
        });
    });

    it('워밍업(score null) 점은 기간에 넣지 않는다', () => {
        const warmup: FearGreedHistoryPoint[] = series(400, 1).map((p, i) =>
            i < 300 ? { ...p, score: null, label: null } : p
        );
        expect(chartWindow(warmup)).toEqual({ kind: 'months', months: 3 });
    });

    it('개월 수는 1 밑으로 내려가지 않는다', () => {
        expect(chartWindow(series(2, 1))).toEqual({
            kind: 'months',
            months: 1,
        });
    });

    it('그릴 점이 없으면 없는 기간을 지어내지 않고 기존 이름(year)을 둔다', () => {
        expect(chartWindow([])).toEqual({ kind: 'year' });
    });
});
