import type { BacktestCase } from '@y0ngha/siglens-core';

/**
 * Display statistics derived directly from `cases`, not from `data.json`'s
 * `meta` block.
 *
 * `meta.aiWinRate` is computed over *decisive* cases only (8/13 = 61.5%;
 * 87 of 100 cases are `neutral`), but the UI used to show the bare 61.5% next
 * to "100 cases" with no denominator, and `meta.period` is a hand-typed string
 * that drifts from the real `entryDate` span. Deriving everything here — with
 * the counts the labels need — means the UI can never omit that context again
 * (SEO audit 2026-09-17, finding H-2).
 */
export interface BacktestStats {
    totalCases: number;
    indicatorWins: number;
    indicatorWinRate: number;
    aiDecisiveCount: number;
    aiWins: number;
    aiWinRateDecisive: number;
    aiNeutralCount: number;
    aiTrendHitRate: number;
    /** Mean of `returnPct` across all cases, 2 decimal places (small values need the extra digit — 1 decimal would round 0.36 to 0.4). */
    meanReturnPct: number;
    /** Median of `holdingDays`; can be fractional when the case count is even. */
    medianHoldingDays: number;
    /** ISO `YYYY-MM-DD`, min/max of `entryDate`. Empty string when `cases` is empty. */
    periodStart: string;
    periodEnd: string;
}

function percent(count: number, total: number): number {
    return total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;
}

function median(values: readonly number[]): number {
    if (values.length === 0) return 0;
    const sorted = values.toSorted((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function deriveBacktestStats(
    cases: readonly BacktestCase[]
): BacktestStats {
    const total = cases.length;
    const indicatorWins = cases.filter(c => c.result === 'win').length;
    const decisive = cases.filter(c => c.aiResult !== 'neutral');
    const aiWins = decisive.filter(c => c.aiResult === 'win').length;
    const trendHits = cases.filter(c => c.aiTrendHit).length;
    const meanReturnPct =
        total > 0
            ? Number(
                  (
                      cases.reduce((sum, c) => sum + c.returnPct, 0) / total
                  ).toFixed(2)
              )
            : 0;
    const entryDates = cases.map(c => c.entryDate).toSorted();

    return {
        totalCases: total,
        indicatorWins,
        indicatorWinRate: percent(indicatorWins, total),
        aiDecisiveCount: decisive.length,
        aiWins,
        aiWinRateDecisive: percent(aiWins, decisive.length),
        aiNeutralCount: total - decisive.length,
        aiTrendHitRate: percent(trendHits, total),
        meanReturnPct,
        medianHoldingDays: median(cases.map(c => c.holdingDays)),
        periodStart: entryDates[0] ?? '',
        periodEnd: entryDates[entryDates.length - 1] ?? '',
    };
}
