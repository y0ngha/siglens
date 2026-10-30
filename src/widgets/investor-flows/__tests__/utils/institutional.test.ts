import { describe, expect, it } from 'vitest';
import {
    buildHoldersTrend,
    buildQuarterBars,
    buildSplitComparison,
    filterHolders,
    findPartialQuarter,
    flowDirection,
    holderChangePercent,
    holderChangeShares,
    splitDeltaKind,
    MAX_QUARTER_BARS,
} from '../../utils/institutional';
import {
    makeHolder,
    makeQuarter,
    makeSnapshot,
} from '../fixtures/flowsFixtures';

const QUARTERS = makeSnapshot().institutional.quarters;

describe('flowDirection', () => {
    it('양수는 in, 음수는 out, 0은 flat이다', () => {
        expect([flowDirection(5), flowDirection(-5), flowDirection(0)]).toEqual(
            ['in', 'out', 'flat']
        );
    });
});

describe('buildQuarterBars', () => {
    it('오래된 분기부터 정렬하고 방향을 붙인다', () => {
        const bars = buildQuarterBars([...QUARTERS].reverse());
        expect(bars.map(b => b.period)).toEqual([
            '2025-12-31',
            '2026-03-31',
            '2026-06-30',
            '2026-09-30',
        ]);
        expect(bars.map(b => b.direction)).toEqual(['in', 'out', 'in', 'in']);
    });

    it('진행 중 분기는 complete: false로 남긴다', () => {
        expect(buildQuarterBars(QUARTERS).at(-1)?.complete).toBe(false);
    });

    it('최신 분기부터 MAX_QUARTER_BARS개만 남긴다', () => {
        const many = Array.from({ length: 10 }, (_, i) =>
            makeQuarter({ period: `20${10 + i}-12-31` })
        );
        const bars = buildQuarterBars(many);
        expect(bars).toHaveLength(MAX_QUARTER_BARS);
        expect(bars.at(-1)?.period).toBe('2019-12-31');
    });

    it('빈 입력은 빈 배열이다', () => {
        expect(buildQuarterBars([])).toEqual([]);
    });
});

describe('buildSplitComparison', () => {
    it('최근 완결 분기를 기준으로 바로 앞 분기와 비교한다', () => {
        const split = buildSplitComparison(QUARTERS)!;
        expect(split.period).toBe('2026-06-30');
        expect(split.previousPeriod).toBe('2026-03-31');
        const byKey = Object.fromEntries(split.metrics.map(m => [m.key, m]));
        expect(byKey.newHolders).toMatchObject({
            value: 310,
            previous: 240,
            delta: 70,
        });
        expect(byKey.decreased).toMatchObject({
            value: 1930,
            previous: 2250,
            delta: -320,
        });
    });

    it('완결 분기가 없으면 최신 분기를 complete: false로 쓴다', () => {
        const split = buildSplitComparison([
            makeQuarter({ period: '2026-09-30', complete: false }),
        ])!;
        expect(split.complete).toBe(false);
        expect(split.previousPeriod).toBeNull();
        expect(split.metrics.every(m => m.delta === null)).toBe(true);
    });

    it('분기가 없으면 null이다', () => {
        expect(buildSplitComparison([])).toBeNull();
    });
});

describe('findPartialQuarter', () => {
    it('기준 분기보다 새로운 부분 집계 분기를 찾는다', () => {
        expect(findPartialQuarter(QUARTERS, '2026-06-30')?.period).toBe(
            '2026-09-30'
        );
    });

    it('부분 집계 분기가 없으면 null이다', () => {
        expect(
            findPartialQuarter(QUARTERS.slice(0, 3), '2026-06-30')
        ).toBeNull();
    });

    it('기준 분기와 같거나 오래된 부분 분기는 무시한다', () => {
        expect(findPartialQuarter(QUARTERS, '2026-09-30')).toBeNull();
    });
});

describe('holders helpers', () => {
    const holders = makeSnapshot().institutional.topHolders;

    it('filterHolders는 신규·청산만 거른다', () => {
        expect(filterHolders(holders, 'new').map(h => h.change)).toEqual([
            'new',
        ]);
        expect(filterHolders(holders, 'exited').map(h => h.change)).toEqual([
            'exited',
        ]);
        expect(filterHolders(holders, 'all')).toHaveLength(4);
    });

    it('holderChangeShares: 신규는 보유 전체, 청산은 음수다', () => {
        expect(
            holderChangeShares(makeHolder({ shares: 100, prevShares: null }))
        ).toBe(100);
        expect(
            holderChangeShares(makeHolder({ shares: 0, prevShares: 50 }))
        ).toBe(-50);
    });

    it('holderChangePercent: 직전 보유가 없거나 0이면 null이다', () => {
        expect(
            holderChangePercent(makeHolder({ shares: 110, prevShares: 100 }))
        ).toBeCloseTo(10);
        expect(
            holderChangePercent(makeHolder({ shares: 10, prevShares: null }))
        ).toBeNull();
        expect(
            holderChangePercent(makeHolder({ shares: 10, prevShares: 0 }))
        ).toBeNull();
    });
});

describe('splitDeltaKind', () => {
    it('null은 none, 0은 flat, 양수는 up, 음수는 down이다', () => {
        expect([
            splitDeltaKind(null),
            splitDeltaKind(0),
            splitDeltaKind(3),
            splitDeltaKind(-3),
        ]).toEqual(['none', 'flat', 'up', 'down']);
    });
});

describe('buildHoldersTrend', () => {
    it('완결 분기만으로 값과 눈금·양끝 분기를 만든다 — 진행 중 분기는 뺀다', () => {
        const bars = buildQuarterBars([
            makeQuarter({ period: '2025-12-31', holders: 5110 }),
            makeQuarter({ period: '2026-03-31', holders: 5160 }),
            makeQuarter({ period: '2026-06-30', holders: 5240 }),
            makeQuarter({
                period: '2026-09-30',
                complete: false,
                holders: 900,
            }),
        ]);
        expect(buildHoldersTrend(bars)).toEqual({
            values: [5110, 5160, 5240],
            max: 5240,
            min: 5110,
            first: 5110,
            last: 5240,
            startPeriod: '2025-12-31',
            endPeriod: '2026-06-30',
        });
    });

    it('완결 분기가 둘 미만이면 null이다', () => {
        expect(
            buildHoldersTrend(
                buildQuarterBars([
                    makeQuarter({ period: '2026-06-30' }),
                    makeQuarter({ period: '2026-09-30', complete: false }),
                ])
            )
        ).toBeNull();
    });
});
