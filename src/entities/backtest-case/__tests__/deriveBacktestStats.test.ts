import type { BacktestCase } from '@y0ngha/siglens-core';
import backtestData from '@/app/[locale]/backtesting/data.json';
import { deriveBacktestStats } from '../lib/deriveBacktestStats';

function makeCase(overrides: Partial<BacktestCase>): BacktestCase {
    return {
        ticker: 'TEST',
        entryDate: '2025-01-01',
        entryPrice: 100,
        exitDate: '2025-01-05',
        exitPrice: 101,
        holdingDays: 4,
        returnPct: 1,
        signalType: 'buy',
        result: 'win',
        exitReason: 'time',
        aiResult: 'neutral',
        aiTrendHit: false,
        aiAnalysis: {
            summary: '',
            tags: [],
            entryRecommendation: 'wait',
            bullishTargets: [],
        },
        ...overrides,
    };
}

// Synthetic fixture: covers win/loss/neutral, an odd holdingDays sample for
// the median, and a distinct entryDate min/max for the period range.
const CASES: BacktestCase[] = [
    makeCase({
        entryDate: '2025-02-10',
        result: 'win',
        aiResult: 'win',
        aiTrendHit: true,
        returnPct: 4,
        holdingDays: 3,
    }),
    makeCase({
        entryDate: '2025-01-01',
        result: 'loss',
        aiResult: 'loss',
        aiTrendHit: false,
        returnPct: -2,
        holdingDays: 1,
    }),
    makeCase({
        entryDate: '2025-03-20',
        result: 'win',
        aiResult: 'neutral',
        aiTrendHit: true,
        returnPct: 1,
        holdingDays: 5,
    }),
];

describe('deriveBacktestStats', () => {
    it('derives indicator win rate over all cases', () => {
        const stats = deriveBacktestStats(CASES);

        expect(stats.totalCases).toBe(3);
        expect(stats.indicatorWins).toBe(2);
        expect(stats.indicatorWinRate).toBe(66.7);
    });

    it('derives the AI decisive win rate together with the counts the label discloses', () => {
        const stats = deriveBacktestStats(CASES);

        // 1 win, 1 loss decisive (the neutral case is excluded from the rate).
        expect(stats.aiDecisiveCount).toBe(2);
        expect(stats.aiWins).toBe(1);
        expect(stats.aiWinRateDecisive).toBe(50);
        expect(stats.aiNeutralCount).toBe(1);
    });

    it('derives the AI trend hit rate over all cases, decisive or not', () => {
        const stats = deriveBacktestStats(CASES);

        expect(stats.aiTrendHitRate).toBe(66.7);
    });

    it('derives the period from entryDate min/max', () => {
        const stats = deriveBacktestStats(CASES);

        expect(stats.periodStart).toBe('2025-01-01');
        expect(stats.periodEnd).toBe('2025-03-20');
    });

    it('derives the mean return across all cases', () => {
        const stats = deriveBacktestStats(CASES);

        expect(stats.meanReturnPct).toBe(1);
    });

    it('derives the median holding days for an odd case count', () => {
        const stats = deriveBacktestStats(CASES);

        // sorted holdingDays: [1, 3, 5] -> middle value.
        expect(stats.medianHoldingDays).toBe(3);
    });

    it('derives a fractional median holding days for an even case count', () => {
        const evenCases = [
            ...CASES,
            makeCase({ entryDate: '2025-04-01', holdingDays: 9 }),
        ];
        const stats = deriveBacktestStats(evenCases);

        // sorted holdingDays: [1, 3, 5, 9] -> (3 + 5) / 2.
        expect(stats.medianHoldingDays).toBe(4);
    });

    it('returns zeroed stats for an empty case list without dividing by zero', () => {
        const stats = deriveBacktestStats([]);

        expect(stats).toEqual({
            totalCases: 0,
            indicatorWins: 0,
            indicatorWinRate: 0,
            aiDecisiveCount: 0,
            aiWins: 0,
            aiWinRateDecisive: 0,
            aiNeutralCount: 0,
            aiTrendHitRate: 0,
            meanReturnPct: 0,
            medianHoldingDays: 0,
            periodStart: '',
            periodEnd: '',
        });
    });
});

describe('deriveBacktestStats (real data.json smoke test)', () => {
    // No hardcoded numbers here — data.json is regenerable and its values
    // drift. This only checks structural invariants the UI depends on.
    it('produces internally consistent stats for the real dataset', () => {
        const realCases = backtestData.cases as unknown as BacktestCase[];
        const stats = deriveBacktestStats(realCases);

        expect(stats.totalCases).toBe(realCases.length);
        expect(stats.aiDecisiveCount + stats.aiNeutralCount).toBe(
            stats.totalCases
        );
        expect(stats.indicatorWins).toBeLessThanOrEqual(stats.totalCases);
        expect(stats.aiWins).toBeLessThanOrEqual(stats.aiDecisiveCount);

        for (const rate of [
            stats.indicatorWinRate,
            stats.aiWinRateDecisive,
            stats.aiTrendHitRate,
        ]) {
            expect(rate).toBeGreaterThanOrEqual(0);
            expect(rate).toBeLessThanOrEqual(100);
        }

        expect(stats.periodStart <= stats.periodEnd).toBe(true);
    });
});
