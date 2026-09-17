import type { BacktestCase } from '@y0ngha/siglens-core';
import backtestData from '@/app/[locale]/backtesting/data.json';
import { deriveBacktestStats } from '../lib/deriveBacktestStats';

// Real production dataset (100 cases) — the numbers below are ground truth,
// independently verified against `meta` and against the raw case fields
// (see docs/superpowers SEO audit finding H-2).
const REAL_CASES = backtestData.cases as unknown as BacktestCase[];

describe('deriveBacktestStats', () => {
    it('derives the AI decisive win rate as 8/13 (61.5%) together with the counts the label discloses', () => {
        const stats = deriveBacktestStats(REAL_CASES);

        expect(stats.aiDecisiveCount).toBe(13);
        expect(stats.aiWins).toBe(8);
        expect(stats.aiWinRateDecisive).toBe(61.5);
        expect(stats.aiNeutralCount).toBe(87);
    });

    it('derives the AI trend hit rate as 35%', () => {
        const stats = deriveBacktestStats(REAL_CASES);

        expect(stats.aiTrendHitRate).toBe(35);
    });

    it('derives the period from entryDate min/max, not the hardcoded meta.period', () => {
        const stats = deriveBacktestStats(REAL_CASES);

        expect(stats.periodStart).toBe('2024-11-26');
        expect(stats.periodEnd).toBe('2026-03-31');
    });

    it('derives indicator win rate and total cases', () => {
        const stats = deriveBacktestStats(REAL_CASES);

        expect(stats.totalCases).toBe(100);
        expect(stats.indicatorWins).toBe(70);
        expect(stats.indicatorWinRate).toBe(70);
    });

    it('derives mean return and median holding days', () => {
        const stats = deriveBacktestStats(REAL_CASES);

        expect(stats.meanReturnPct).toBe(0.36);
        expect(stats.medianHoldingDays).toBe(2.5);
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
