import type { FearGreedLabel } from '@y0ngha/siglens-core';
import { FEAR_GREED_SESSIONS_PER_YEAR } from '@/entities/market-fear-greed/lib/buildMarketFearGreedComparisons';
import type { ScoredReading } from '@/entities/market-fear-greed/lib/publishableHistory';
import {
    chartHistory,
    HISTORY_CHART_POINTS,
    historyCoverage,
    monthlyHistoryRows,
    RECENT_HISTORY_ROWS,
    recentHistoryRows,
} from '../marketFearGreedHistoryRows';

const LABEL: FearGreedLabel = 'NEUTRAL';

function pt(date: string, score: number, label = LABEL): ScoredReading {
    return { date, score, label };
}

/** `start`부터 하루씩 `count`개. 점수는 `scoreOf(i)`. */
function daily(
    start: string,
    count: number,
    scoreOf: (i: number) => number = i => 50 + (i % 7)
): ScoredReading[] {
    const startMs = Date.parse(`${start}T00:00:00Z`);
    return Array.from({ length: count }, (_, i) =>
        pt(
            new Date(startMs + i * 86_400_000).toISOString().slice(0, 10),
            scoreOf(i)
        )
    );
}

describe('historyCoverage', () => {
    it('첫·마지막 날짜와 점수 있는 날 수를 돌려준다', () => {
        expect(historyCoverage(daily('2025-01-01', 40))).toEqual({
            from: '2025-01-01',
            to: '2025-02-09',
            count: 40,
        });
    });
});

describe('recentHistoryRows', () => {
    it('최근 20일을 최신이 먼저 오게 돌려준다', () => {
        const rows = recentHistoryRows(daily('2025-01-01', 50));
        expect(rows).toHaveLength(RECENT_HISTORY_ROWS);
        expect(rows[0].date).toBe('2025-02-19');
        expect(rows.at(-1)?.date).toBe('2025-01-31');
    });

    it('변화는 직전 점수 있는 날과의 차이다', () => {
        const points = [
            pt('2025-01-01', 40),
            pt('2025-01-02', 47),
            // 중간 빈 날(점수 없음)은 입력에 없으므로 직전은 1월 2일이다.
            pt('2025-01-05', 44),
        ];
        const rows = recentHistoryRows(points);
        expect(rows.map(r => [r.date, r.change])).toEqual([
            ['2025-01-05', -3],
            ['2025-01-02', 7],
            ['2025-01-01', null],
        ]);
    });

    it('표 20행 안에 기록의 첫 점이 없으면 변화가 모두 숫자다', () => {
        const rows = recentHistoryRows(daily('2025-01-01', 30));
        expect(rows.every(r => r.change !== null)).toBe(true);
    });

    it('기록이 딱 20일이면 맨 아래(첫 점)만 null이다', () => {
        const rows = recentHistoryRows(daily('2025-01-01', 20));
        expect(rows.map(r => r.change === null)).toEqual([
            ...Array.from({ length: 19 }, () => false),
            true,
        ]);
    });

    it('라벨과 점수를 그대로 싣는다', () => {
        const [row] = recentHistoryRows([pt('2025-01-01', 10, 'EXTREME_FEAR')]);
        expect(row).toEqual({
            date: '2025-01-01',
            score: 10,
            label: 'EXTREME_FEAR',
            change: null,
        });
    });
});

describe('monthlyHistoryRows', () => {
    const points = [
        pt('2025-01-30', 50, 'NEUTRAL'),
        pt('2025-01-31', 52, 'NEUTRAL'),
        pt('2025-02-03', 30, 'FEAR'),
        pt('2025-02-04', 70, 'GREED'),
        pt('2025-02-05', 30, 'FEAR'),
        pt('2025-02-06', 70, 'GREED'),
        pt('2025-02-07', 60, 'GREED'),
        pt('2025-03-03', 55, 'GREED'),
    ];

    it('최신 달이 먼저 오고 달마다 마지막·최저·최고를 담는다', () => {
        const rows = monthlyHistoryRows(points);
        expect(rows.map(r => r.month)).toEqual([
            '2025-03',
            '2025-02',
            '2025-01',
        ]);
        const feb = rows[1];
        expect(feb.last).toEqual({
            date: '2025-02-07',
            score: 60,
            label: 'GREED',
        });
        expect(feb.low).toEqual({ date: '2025-02-03', score: 30 });
        expect(feb.high).toEqual({ date: '2025-02-04', score: 70 });
    });

    it('최저·최고가 같은 값이면 먼저 나온 날이다', () => {
        const [feb] = monthlyHistoryRows(points).filter(
            r => r.month === '2025-02'
        );
        // 2/3과 2/5가 모두 30, 2/4와 2/6이 모두 70.
        expect(feb.low.date).toBe('2025-02-03');
        expect(feb.high.date).toBe('2025-02-04');
    });

    it('첫 달은 start, 마지막 점이 든 달은 end, 그 사이는 null이다', () => {
        expect(monthlyHistoryRows(points).map(r => r.partial)).toEqual([
            'end',
            null,
            'start',
        ]);
    });

    it('한 달뿐이면 end가 이긴다', () => {
        const [only] = monthlyHistoryRows([
            pt('2025-05-01', 50),
            pt('2025-05-02', 51),
        ]);
        expect(only.partial).toBe('end');
    });

    it('빈 입력은 빈 배열이다', () => {
        expect(monthlyHistoryRows([])).toEqual([]);
    });
});

describe('chartHistory', () => {
    it('마지막 252개를 날짜 오름차순으로 돌려준다', () => {
        const points = daily('2024-01-01', 400);
        const slice = chartHistory(points);
        expect(slice).toHaveLength(HISTORY_CHART_POINTS);
        expect(slice[0]).toBe(points[400 - HISTORY_CHART_POINTS]);
        expect(slice.at(-1)).toBe(points[399]);
    });

    it('252는 차트가 그리는 길이(1년 세션 수)와 같다', () => {
        expect(HISTORY_CHART_POINTS).toBe(FEAR_GREED_SESSIONS_PER_YEAR);
    });

    it('252개보다 적으면 전부 돌려준다', () => {
        expect(chartHistory(daily('2025-01-01', 30))).toHaveLength(30);
    });
});
