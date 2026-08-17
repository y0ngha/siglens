import { describe, it, expect } from 'vitest';
import { mapAnalystEstimate, mapEarningsReports } from '../yahooFundamentalMap';
import type { YahooFundamentals } from '../yahooFundamentalSource';

function data(summary: unknown): YahooFundamentals {
    return {
        summary: summary as YahooFundamentals['summary'],
        income: [],
        balance: [],
        cashFlow: [],
        quarterlyBalance: [],
    };
}

describe('mapAnalystEstimate', () => {
    it('uses the current-quarter (0q) estimate', () => {
        // 연간(0y)은 이미 지나간 분기가 섞여 있어 발표 임박 시점의 기대치를 못 담는다.
        const result = mapAnalystEstimate(
            data({
                earningsTrend: {
                    trend: [
                        {
                            period: '0y',
                            earningsEstimate: { avg: 48526 },
                            revenueEstimate: { avg: 732_933_496_690_000 },
                        },
                        {
                            period: '0q',
                            earningsEstimate: { avg: 14227.344 },
                            revenueEstimate: { avg: 208_971_462_890_000 },
                        },
                    ],
                },
            })
        );

        expect(result).toEqual({
            estimatedEpsAvg: 14227.344,
            estimatedRevenueAvg: 208_971_462_890_000,
        });
    });

    it('falls back to the first trend entry when 0q is absent', () => {
        expect(
            mapAnalystEstimate(
                data({
                    earningsTrend: {
                        trend: [
                            { period: '+1q', earningsEstimate: { avg: 100 } },
                        ],
                    },
                })
            )
        ).toEqual({ estimatedEpsAvg: 100, estimatedRevenueAvg: null });
    });

    it('returns null when both values are missing (no analyst coverage)', () => {
        expect(
            mapAnalystEstimate(
                data({ earningsTrend: { trend: [{ period: '0q' }] } })
            )
        ).toBeNull();
    });

    it('returns null when the module is absent', () => {
        expect(mapAnalystEstimate(data({}))).toBeNull();
        expect(mapAnalystEstimate(data(null))).toBeNull();
    });
});

describe('mapEarningsReports', () => {
    const summary = {
        calendarEvents: {
            earnings: {
                earningsDate: [new Date('2026-10-28T06:00:00.000Z')],
                isEarningsDateEstimate: true,
                earningsAverage: 14227.344,
                revenueAverage: 208_971_462_890_000,
            },
        },
        earningsHistory: {
            history: [
                {
                    quarter: new Date('2025-12-31T00:00:00.000Z'),
                    epsActual: 2909,
                    epsEstimate: 2361.2585,
                    surprisePercent: 0.232,
                },
                {
                    quarter: new Date('2026-03-31T00:00:00.000Z'),
                    epsActual: 7123,
                    epsEstimate: 5089.3823,
                    surprisePercent: 0.3996,
                },
            ],
        },
    };

    it('merges the upcoming date with past results, newest first', () => {
        const items = mapEarningsReports('005930.KS', data(summary), 10);

        expect(items.map(i => i.earningsDate)).toEqual([
            '2026-10-28',
            '2026-03-31',
            '2025-12-31',
        ]);
    });

    it('marks the upcoming row as an estimated date', () => {
        // 확정 공시일이 아니라 yahoo 추정이므로 상위가 "예정(추정)"으로 구분해야 한다.
        const [upcoming] = mapEarningsReports('005930.KS', data(summary), 10);

        expect(upcoming).toMatchObject({
            earningsDate: '2026-10-28',
            epsActual: null,
            epsEstimated: 14227.344,
            revenueEstimated: 208_971_462_890_000,
            isEstimatedDate: true,
        });
    });

    it('carries actual vs estimate for past quarters', () => {
        const items = mapEarningsReports('005930.KS', data(summary), 10);
        const q1 = items.find(i => i.earningsDate === '2026-03-31');

        expect(q1).toMatchObject({
            epsActual: 7123,
            epsEstimated: 5089.3823,
            // yahoo earningsHistory는 매출을 주지 않는다.
            revenueActual: null,
            revenueEstimated: null,
            isEstimatedDate: false,
        });
    });

    it('respects the limit', () => {
        expect(mapEarningsReports('005930.KS', data(summary), 2)).toHaveLength(
            2
        );
    });

    it('returns empty when neither module is present', () => {
        expect(mapEarningsReports('005930.KS', data({}), 10)).toEqual([]);
    });

    it('skips history rows without a usable quarter date', () => {
        expect(
            mapEarningsReports(
                '005930.KS',
                data({
                    earningsHistory: {
                        history: [{ epsActual: 1 }, { quarter: 'nope' }],
                    },
                }),
                10
            )
        ).toEqual([]);
    });
});
