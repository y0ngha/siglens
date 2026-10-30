import type { FearGreedHistoryPoint } from '@y0ngha/siglens-core';
import { FEAR_GREED_SESSIONS_PER_YEAR } from '@/entities/market-fear-greed/lib/buildMarketFearGreedComparisons';
import { buildComparisonTiles } from '../../utils/comparisonTiles';

/** 인덱스 i의 날짜는 2025-01-01 + i일, 점수는 `startScore + i`. */
function makeHistory(length: number, startScore = 10): FearGreedHistoryPoint[] {
    return Array.from({ length }, (_, i) => ({
        date: new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10),
        score: startScore + (i % 80),
        label: 'NEUTRAL' as const,
    }));
}

describe('buildComparisonTiles', () => {
    it('빈 history는 빈 배열이다', () => {
        expect(buildComparisonTiles([])).toEqual([]);
    });

    it('워밍업(null)뿐인 history도 빈 배열이다', () => {
        const warmUp: FearGreedHistoryPoint[] = [
            { date: '2025-01-01', score: null, label: null },
        ];
        expect(buildComparisonTiles(warmUp)).toEqual([]);
    });

    it('현재·1주·1개월·1년 순서의 기간 메시지 키를 돌려준다', () => {
        const tiles = buildComparisonTiles(makeHistory(300));
        expect(tiles.map(t => [t.key, t.periodMessageKey])).toEqual([
            ['now', 'now'],
            ['1w', 'week'],
            ['1m', 'month'],
            ['1y', 'year'],
        ]);
    });

    it('history가 충분하면 clamped가 없고 날짜는 거래일 수만큼 거슬러 올라간 세션이다', () => {
        const tiles = buildComparisonTiles(makeHistory(300));
        expect(tiles.map(t => t.clamped)).toEqual([false, false, false, false]);
        expect(tiles.map(t => t.date)).toEqual([
            '2025-10-27',
            '2025-10-22',
            '2025-10-06',
            '2025-02-17',
        ]);
    });

    it('1년 기준은 FEAR_GREED_SESSIONS_PER_YEAR다 — 그만큼 쌓였을 때 처음 닿는다', () => {
        const justEnough = buildComparisonTiles(
            makeHistory(FEAR_GREED_SESSIONS_PER_YEAR + 1)
        );
        const oneShort = buildComparisonTiles(
            makeHistory(FEAR_GREED_SESSIONS_PER_YEAR)
        );
        expect(justEnough[3].clamped).toBe(false);
        expect(oneShort[3].clamped).toBe(true);
    });

    it('짧은 history에서는 닿지 못한 기간만 가장 오래된 세션으로 clamp된다', () => {
        const history = makeHistory(10);
        const tiles = buildComparisonTiles(history);
        expect(tiles.map(t => t.clamped)).toEqual([false, false, true, true]);
        expect(tiles[2].date).toBe('2025-01-01');
        expect(tiles[3].date).toBe('2025-01-01');
    });

    it('점수는 반올림하고 라벨은 반올림 점수가 다른 구간이어도 core 라벨을 그대로 쓴다', () => {
        const history: FearGreedHistoryPoint[] = [
            { date: '2025-01-01', score: 44.6, label: 'FEAR' },
        ];
        expect(buildComparisonTiles(history)[0]).toMatchObject({
            score: 45,
            label: 'FEAR',
        });
    });

    it('label이 null인 점은 점수가 있어도 비교에 쓰지 않는다', () => {
        const history: FearGreedHistoryPoint[] = [
            { date: '2025-01-01', score: 50, label: null },
        ];
        expect(buildComparisonTiles(history)).toEqual([]);
    });
});
