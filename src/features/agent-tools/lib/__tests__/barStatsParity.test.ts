import {
    aggregateBarsToMonthly,
    aggregateBarsToWeekly,
    calculateIndicators,
    computeBarChangeStats,
    computeBarRangeStats,
    computeCloseStreak,
    computeEarningsReactions,
    CRYPTO_SESSION,
    scanLongTermMaCrosses,
    US_EQUITY_SESSION,
    type AgentBarsTimeframe,
    type Bar,
    type IndicatorResult,
    type MarketSessionSpec,
} from '@y0ngha/siglens-core';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
    chartReferenceLevels as oracleChartReferenceLevels,
    computeDerived as oracleComputeDerived,
    computeRangeWindow as oracleComputeRangeWindow,
    earningsReactions as oracleEarningsReactions,
} from '@/features/agent-tools/lib/__tests__/barStatsOracle';
import {
    BAR_STATS_CORPUS_SIZE,
    makeBarStatsCorpus,
    type BarStatsCase,
} from '@/features/agent-tools/lib/__tests__/fixtures/barStatsCorpus';
import { earningsReactions } from '@/features/agent-tools/lib/earningsHistory';
import { chartReferenceLevels } from '@/features/agent-tools/lib/levelCandidates';
import { computeRangeWindow } from '@/features/agent-tools/lib/rangeWindow';
import {
    resetWorld,
    world,
} from '@/features/agent-tools/server/__tests__/golden/boundary';
import {
    CLOCKS,
    listCrypto,
    listIndexLike,
    listKrStock,
    listSecondKrStock,
    listSecondUsStock,
    listThirdUsStock,
    listUsStock,
    SYMBOLS,
} from '@/features/agent-tools/server/__tests__/golden/goldenCase';
import {
    barsFor,
    dailyBars,
} from '@/features/agent-tools/server/__tests__/golden/syntheticMarket';
import { computeDerived } from '@/features/agent-tools/server/tools/getBarsIndicators';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';

/**
 * Math parity gate for moving the bar statistics to core: the pre-core siglens
 * implementations (`barStatsOracle.ts`, copied verbatim) and the core-backed
 * code must print the same bytes for every input, AFTER the siglens
 * projection (date strings, percent rounding, key names, null policy).
 *
 * Inputs: core's seeded corpus (2,000 random-walk daily series, lengths
 * 0..1,300, injected NaN/Infinity/zero/negative values, equal-close runs, ties
 * at the extremes, forming last bar), each run as 1Day plus one other
 * timeframe; and the synthetic market series behind the executor goldens.
 *
 * The comparison serializes non-finite numbers and `-0` as tagged strings, so a
 * `NaN` that became `null` (which plain `JSON.stringify` would hide) is a
 * mismatch too. The oracle, its corpus mirror and this test are deleted in the
 * last commit of the PR that moved the math.
 */

/** Full corpus × five entry points plus `calculateIndicators` on the fixture series: well above the 5s default. */
const HEAVY_COMPUTE_TIMEOUT_MS = 120_000;

/**
 * Core's committed digest of its raw output over the same corpus
 * (`barStats.test.ts`, "parity corpus"). Matching it proves the mirrored
 * generator yields core's inputs exactly.
 */
const CORE_CORPUS_DIGEST =
    '32d0fd870a3ddf3692ac709ceb50319c98698cf4f5eaff7bd1a6605165d82ba0';

const OTHER_TIMEFRAMES: readonly AgentBarsTimeframe[] = [
    '1Hour',
    '1Week',
    '1Month',
    '15Min',
];

function strictJson(value: unknown): string {
    return JSON.stringify(value, (_key, v: unknown) => {
        if (typeof v !== 'number') return v;
        if (Object.is(v, -0)) return '<-0>';
        return Number.isFinite(v) ? v : `<${String(v)}>`;
    });
}

interface Comparison {
    label: string;
    old: () => unknown;
    next: () => unknown;
}

/** Labels of the comparisons whose old and new output differ. */
function mismatches(comparisons: readonly Comparison[]): string[] {
    return comparisons
        .filter(c => strictJson(c.old()) !== strictJson(c.next()))
        .map(c => c.label);
}

function derivedComparison(
    label: string,
    bars: readonly Bar[],
    indicators: IndicatorResult,
    timeframe: AgentBarsTimeframe,
    lastBarInProgress: boolean
): Comparison {
    return {
        label: `${label} derived ${timeframe} forming=${String(lastBarInProgress)}`,
        old: () =>
            oracleComputeDerived(
                bars,
                indicators,
                timeframe,
                lastBarInProgress
            ),
        next: () =>
            computeDerived(bars, indicators, timeframe, lastBarInProgress),
    };
}

function corpusComparisons(c: BarStatsCase): Comparison[] {
    // The corpus carries only the series the stats read (atr, ma, ema); the
    // derived view also reads `ma` for the stack, which is present.
    const indicators = c.indicators as unknown as IndicatorResult;
    const label = `seed ${String(c.seed)}`;
    const other = OTHER_TIMEFRAMES[c.seed % OTHER_TIMEFRAMES.length] ?? '1Hour';
    const lastClose = c.bars.at(-1)?.close ?? null;
    const dayLabel = (t: number) => `t${String(t)}`;
    return [
        derivedComparison(label, c.bars, indicators, '1Day', c.lastBarForming),
        derivedComparison(label, c.bars, indicators, other, c.lastBarForming),
        {
            label: `${label} range window`,
            old: () => oracleComputeRangeWindow(c.bars, lastClose, dayLabel),
            next: () => computeRangeWindow(c.bars, lastClose, dayLabel),
        },
        {
            label: `${label} earnings reactions`,
            old: () =>
                oracleEarningsReactions(
                    c.bars,
                    c.reportedDates,
                    c.lastBarForming
                ),
            next: () =>
                earningsReactions(c.bars, c.reportedDates, c.lastBarForming),
        },
        {
            label: `${label} chart reference levels`,
            old: () => oracleChartReferenceLevels(c.bars, indicators),
            next: () => chartReferenceLevels(c.bars, indicators),
        },
    ];
}

interface FixtureSeries {
    label: string;
    bars: Bar[];
    timeframe: AgentBarsTimeframe;
}

function fixtureSeries(): FixtureSeries[] {
    resetWorld();
    [
        listUsStock,
        listSecondUsStock,
        listThirdUsStock,
        listKrStock,
        listSecondKrStock,
        listCrypto,
        listIndexLike,
    ].forEach(list => list());
    const krSession = sessionSpecFor('kr-equity');
    const daily = (
        symbol: string,
        session: MarketSessionSpec,
        clock: string
    ): Bar[] => {
        const s = world.series[symbol];
        return s === undefined ? [] : dailyBars(s, session, new Date(clock));
    };
    const usOpenDaily = daily(SYMBOLS.us, US_EQUITY_SESSION, CLOCKS.usOpen);
    const usWeekendDaily = daily(SYMBOLS.us, US_EQUITY_SESSION, CLOCKS.weekend);
    const usSpec = world.series[SYMBOLS.us];
    // The index-like asset trades under its provider symbol (`fmpSymbol`).
    const indexSpec = world.series['^GLD500'];
    return [
        { label: 'us open', bars: usOpenDaily, timeframe: '1Day' },
        {
            label: 'us closed',
            bars: daily(SYMBOLS.us, US_EQUITY_SESSION, CLOCKS.usClosed),
            timeframe: '1Day',
        },
        {
            label: 'us weekend weekly',
            bars: aggregateBarsToWeekly(usWeekendDaily),
            timeframe: '1Week',
        },
        {
            label: 'us open monthly',
            bars: aggregateBarsToMonthly(usOpenDaily),
            timeframe: '1Month',
        },
        {
            label: 'us2 closed',
            bars: daily(SYMBOLS.us2, US_EQUITY_SESSION, CLOCKS.usClosed),
            timeframe: '1Day',
        },
        {
            label: 'us3 closed',
            bars: daily(SYMBOLS.us3, US_EQUITY_SESSION, CLOCKS.usClosed),
            timeframe: '1Day',
        },
        {
            label: 'kr session',
            bars: daily(SYMBOLS.kr, krSession, CLOCKS.krSession),
            timeframe: '1Day',
        },
        {
            label: 'kr2 session',
            bars: daily(SYMBOLS.kr2, krSession, CLOCKS.krSession),
            timeframe: '1Day',
        },
        {
            label: 'crypto sunday',
            bars: daily(SYMBOLS.crypto, CRYPTO_SESSION, CLOCKS.crypto),
            timeframe: '1Day',
        },
        {
            label: 'us dst 1hour',
            bars:
                usSpec === undefined
                    ? []
                    : barsFor(
                          usSpec,
                          US_EQUITY_SESSION,
                          new Date(CLOCKS.usDst),
                          { symbol: SYMBOLS.us, timeframe: '1Hour' }
                      ),
            timeframe: '1Hour',
        },
        {
            label: 'index 15min',
            bars:
                indexSpec === undefined
                    ? []
                    : barsFor(
                          indexSpec,
                          US_EQUITY_SESSION,
                          new Date(CLOCKS.usClosed),
                          { symbol: '^GLD500', timeframe: '15Min' }
                      ),
            timeframe: '15Min',
        },
    ];
}

function fixtureComparisons(series: FixtureSeries): Comparison[] {
    const indicators = calculateIndicators(series.bars);
    const lastClose = series.bars.at(-1)?.close ?? null;
    const dayLabel = (t: number) => `t${String(t)}`;
    return [
        derivedComparison(
            series.label,
            series.bars,
            indicators,
            series.timeframe,
            false
        ),
        derivedComparison(
            series.label,
            series.bars,
            indicators,
            series.timeframe,
            true
        ),
        {
            label: `${series.label} range window`,
            old: () =>
                oracleComputeRangeWindow(series.bars, lastClose, dayLabel),
            next: () => computeRangeWindow(series.bars, lastClose, dayLabel),
        },
        {
            label: `${series.label} chart reference levels`,
            old: () => oracleChartReferenceLevels(series.bars, indicators),
            next: () => chartReferenceLevels(series.bars, indicators),
        },
    ];
}

describe('bar statistics: pre-core oracle vs core-backed projection', () => {
    it(
        'the mirrored corpus is core’s corpus (same raw-output digest)',
        { timeout: HEAVY_COMPUTE_TIMEOUT_MS },
        () => {
            const corpus = makeBarStatsCorpus();
            expect(corpus).toHaveLength(BAR_STATS_CORPUS_SIZE);
            const outputs = corpus.map(c => [
                computeBarRangeStats(c.bars, c.bars.at(-1)?.close ?? null),
                computeCloseStreak(c.bars, {
                    excludeLastBar: c.lastBarForming,
                }),
                scanLongTermMaCrosses(c.bars),
                computeBarChangeStats(c.bars, c.indicators, {
                    barsBack: { '1bar': 1, '20bars': 20, '252bars': 252 },
                    partialPeriod: c.lastBarForming,
                }),
                computeEarningsReactions(c.bars, c.reportedDates, {
                    excludeLastBar: c.lastBarForming,
                    limit: 8,
                }),
            ]);
            const digest = createHash('sha256')
                .update(JSON.stringify(outputs))
                .digest('hex');
            expect(digest).toBe(CORE_CORPUS_DIGEST);
        }
    );

    it(
        'prints the same bytes over the seeded corpus',
        { timeout: HEAVY_COMPUTE_TIMEOUT_MS },
        () => {
            const comparisons = makeBarStatsCorpus().flatMap(corpusComparisons);
            expect({
                comparisons: comparisons.length,
                mismatches: mismatches(comparisons),
            }).toEqual({
                comparisons: BAR_STATS_CORPUS_SIZE * 5,
                mismatches: [],
            });
        }
    );

    it(
        'prints the same bytes over the golden fixture series',
        { timeout: HEAVY_COMPUTE_TIMEOUT_MS },
        () => {
            const series = fixtureSeries();
            // Every fixture series must be loaded, or the gate would pass on empty input.
            expect(series.filter(s => s.bars.length === 0)).toEqual([]);
            const comparisons = series.flatMap(fixtureComparisons);
            expect({
                comparisons: comparisons.length,
                mismatches: mismatches(comparisons),
            }).toEqual({ comparisons: series.length * 4, mismatches: [] });
        }
    );

    it(
        'the corpus reaches the branches the projection forks on',
        { timeout: HEAVY_COMPUTE_TIMEOUT_MS },
        () => {
            const derived = makeBarStatsCorpus().map(c =>
                computeDerived(
                    c.bars,
                    c.indicators as unknown as IndicatorResult,
                    '1Day',
                    c.lastBarForming
                )
            );
            expect(derived.some(d => d.closeStreak?.truncated === true)).toBe(
                true
            );
            expect(derived.some(d => d.closeStreak?.truncated === false)).toBe(
                true
            );
            expect(derived.some(d => d.closeStreak === null)).toBe(true);
            expect(
                derived.some(
                    d => d.maCross50_200 !== null && d.maCross50_200.length > 0
                )
            ).toBe(true);
            expect(derived.some(d => d.maCross50_200 === null)).toBe(true);
            expect(derived.some(d => d.range.high === null)).toBe(true);
            expect(derived.some(d => d.range.fromHighPct === null)).toBe(true);
            expect(derived.some(d => d.volumeVsAvg20 === null)).toBe(true);
            expect(derived.some(d => d.volumeVsAvg20 !== null)).toBe(true);
        }
    );
});
