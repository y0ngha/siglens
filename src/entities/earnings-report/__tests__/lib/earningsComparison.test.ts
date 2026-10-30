import { toComparisonItems } from '../../lib/earningsComparison';

describe('toComparisonItems', () => {
    it('빈 배열이면 빈 결과를 반환한다', () => {
        expect(toComparisonItems([], '2026-05-10')).toEqual([]);
    });

    it('과거 항목이 1개뿐이면 recent-or-future 슬롯으로 반환', () => {
        const result = toComparisonItems(
            [
                {
                    symbol: 'AAPL',
                    earningsDate: '2026-04-30',
                    epsActual: '2.01',
                    epsEstimated: '1.95',
                    revenueActual: '111184000000',
                    revenueEstimated: '109457600000',
                    lastUpdated: '2026-05-10',
                },
            ],
            '2026-05-10'
        );
        expect(result).toHaveLength(1);
        expect(result[0].slot).toBe('recent-or-future');
    });

    it('과거 항목이 2개뿐이면 past-1 + recent-or-future 슬롯으로 반환', () => {
        const result = toComparisonItems(
            [
                {
                    symbol: 'AAPL',
                    earningsDate: '2026-01-29',
                    epsActual: '2.85',
                    epsEstimated: '2.67',
                    revenueActual: '143756000000',
                    revenueEstimated: '138391000000',
                    lastUpdated: '2026-04-29',
                },
                {
                    symbol: 'AAPL',
                    earningsDate: '2026-04-30',
                    epsActual: '2.01',
                    epsEstimated: '1.95',
                    revenueActual: '111184000000',
                    revenueEstimated: '109457600000',
                    lastUpdated: '2026-05-10',
                },
            ],
            '2026-05-10'
        ).map(item => [item.earningsDate, item.slot]);
        expect(result).toEqual([
            ['2026-01-29', 'past-1'],
            ['2026-04-30', 'recent-or-future'],
        ]);
    });

    it('미래 항목만 있고 과거 없으면 future 1개를 반환한다', () => {
        const result = toComparisonItems(
            [
                {
                    symbol: 'AAPL',
                    earningsDate: '2026-07-30',
                    epsActual: null,
                    epsEstimated: '1.86',
                    revenueActual: null,
                    revenueEstimated: '107618800000',
                    lastUpdated: '2026-05-10',
                },
            ],
            '2026-05-10'
        );
        expect(result).toHaveLength(1);
        expect(result[0].period).toBe('future');
        expect(result[0].slot).toBe('recent-or-future');
    });

    it('미래 항목이 2개 이상이면 가장 이른 미래를 future로 반환한다 (compareEarningsDateAsc 구동)', () => {
        // 입력을 날짜 내림차순으로 넣어 upcoming.toSorted(asc) 비교 콜백이 실제 실행되는지 검증.
        const result = toComparisonItems(
            [
                {
                    symbol: 'AAPL',
                    earningsDate: '2026-10-29',
                    epsActual: null,
                    epsEstimated: '2.10',
                    revenueActual: null,
                    revenueEstimated: '120000000000',
                    lastUpdated: '2026-05-10',
                },
                {
                    symbol: 'AAPL',
                    earningsDate: '2026-07-30',
                    epsActual: null,
                    epsEstimated: '1.86',
                    revenueActual: null,
                    revenueEstimated: '107618800000',
                    lastUpdated: '2026-05-10',
                },
            ],
            '2026-05-10'
        );
        // 오름차순 정렬 → 가장 이른 2026-07-30이 선택된다(내림차순 입력이어도).
        expect(result).toHaveLength(1);
        expect(result[0].earningsDate).toBe('2026-07-30');
        expect(result[0].period).toBe('future');
        expect(result[0].slot).toBe('recent-or-future');
    });

    it('미래 항목 중 estimate 없으면 제외된다', () => {
        const result = toComparisonItems(
            [
                {
                    symbol: 'AAPL',
                    earningsDate: '2026-07-30',
                    epsActual: null,
                    epsEstimated: null,
                    revenueActual: null,
                    revenueEstimated: null,
                    lastUpdated: '2026-05-10',
                },
            ],
            '2026-05-10'
        );
        expect(result).toEqual([]);
    });

    it('미래 항목이 없으면 최근 과거 3개를 오래된 순서부터 반환한다', () => {
        expect(
            toComparisonItems(
                [
                    {
                        symbol: 'AAPL',
                        earningsDate: '2026-04-30',
                        epsActual: '2.01',
                        epsEstimated: '1.95',
                        revenueActual: '111184000000',
                        revenueEstimated: '109457600000',
                        lastUpdated: '2026-05-10',
                    },
                    {
                        symbol: 'AAPL',
                        earningsDate: '2026-01-29',
                        epsActual: '2.85',
                        epsEstimated: '2.67',
                        revenueActual: '143756000000',
                        revenueEstimated: '138391000000',
                        lastUpdated: '2026-04-29',
                    },
                    {
                        symbol: 'AAPL',
                        earningsDate: '2025-10-30',
                        epsActual: '1.85',
                        epsEstimated: '1.77',
                        revenueActual: '102466000000',
                        revenueEstimated: '102240000000',
                        lastUpdated: '2026-01-01',
                    },
                ],
                '2026-05-10'
            ).map(item => [item.earningsDate, item.slot])
        ).toEqual([
            ['2025-10-30', 'past-2'],
            ['2026-01-29', 'past-1'],
            ['2026-04-30', 'recent-or-future'],
        ]);
    });
});

describe('toComparisonItems — assignPastSlots with 1 past entry + upcoming', () => {
    it('assigns past-1 slot when only 1 past entry with upcoming future', () => {
        const result = toComparisonItems(
            [
                {
                    symbol: 'AAPL',
                    earningsDate: '2026-04-30',
                    epsActual: '2.01',
                    epsEstimated: '1.95',
                    revenueActual: '111184000000',
                    revenueEstimated: '109457600000',
                    lastUpdated: '2026-05-10',
                },
                {
                    symbol: 'AAPL',
                    earningsDate: '2026-07-30',
                    epsActual: null,
                    epsEstimated: '1.86',
                    revenueActual: null,
                    revenueEstimated: '107618800000',
                    lastUpdated: '2026-05-10',
                },
            ],
            '2026-05-10'
        );

        // 1 past + 1 future → assignPastSlots runs with rows.length === 1
        expect(result).toHaveLength(2);
        expect(result[0].slot).toBe('past-1');
        expect(result[0].period).toBe('past');
        expect(result[1].slot).toBe('recent-or-future');
        expect(result[1].period).toBe('future');
    });
});

describe('toComparisonItems — assignTrailingSlots fallback for unexpected length', () => {
    // This is hard to trigger since the function slices to max 3.
    // But we can verify the normal paths are covered:
    it('handles empty trailing slots gracefully', () => {
        const result = toComparisonItems([], '2026-05-10');
        expect(result).toEqual([]);
    });
});
