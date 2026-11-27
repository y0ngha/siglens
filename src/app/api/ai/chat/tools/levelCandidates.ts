import type {
    AnalysisResponse,
    Bar,
    FilteredAnalysisResponse,
    IndicatorResult,
    LevelCandidate,
    LevelSourceKind,
} from '@y0ngha/siglens-core';
import { resolveEffectiveActionLevels } from '@/entities/analysis/lib/effectiveActionLevels';
import { roundIndicators } from '@/entities/bars/lib/roundIndicators';
import { computeRangeWindow } from './rangeWindow';

/**
 * Chart reference prices of a daily series, the inputs of the level ladder
 * (`buildLevelLadder` in core) beside the analysis's own levels. `null` = not
 * computable (too few bars, or no usable average).
 */
export interface ChartReferenceLevels {
    high52w: number | null;
    low52w: number | null;
    high20: number | null;
    low20: number | null;
    sma20: number | null;
    sma50: number | null;
    sma200: number | null;
}

/** Same windows `get_bars_indicators` uses for `derived.range` (252 daily bars) and `derived.ranges['20bars']`. */
const RANGE_52W_BARS = 252;
const RANGE_20_BARS = 20;

const isoDay = (unixSeconds: number): string =>
    new Date(unixSeconds * 1000).toISOString().slice(0, 10);

const lastOrNull = (series: readonly (number | null)[] | undefined) =>
    series !== undefined && series.length > 0
        ? (series[series.length - 1] ?? null)
        : null;

/**
 * 52-week and 20-day high/low and the 20/50/200-day simple averages of a daily series.
 *
 * Must equal what `get_bars_indicators` prints for the SAME series, or the model would see two different "52-week
 * highs" in one turn: the windows are `bars.slice(-252)` / `bars.slice(-20)` through the shared
 * `computeRangeWindow` (intraday high/low, like `derived.range`), and the averages are read from
 * `roundIndicators(indicators).ma` exactly like `latestIndicators`. The 20-day window needs 20 bars (as `ranges`).
 */
export function chartReferenceLevels(
    dailyBars: readonly Bar[],
    indicators: IndicatorResult
): ChartReferenceLevels {
    const range52 = computeRangeWindow(
        dailyBars.slice(-RANGE_52W_BARS),
        null,
        isoDay
    );
    const range20 =
        dailyBars.length >= RANGE_20_BARS
            ? computeRangeWindow(dailyBars.slice(-RANGE_20_BARS), null, isoDay)
            : null;
    const { ma } = roundIndicators(indicators);
    return {
        high52w: range52.high,
        low52w: range52.low,
        high20: range20?.high ?? null,
        low20: range20?.low ?? null,
        sma20: lastOrNull(ma[20]),
        sma50: lastOrNull(ma[50]),
        sma200: lastOrNull(ma[200]),
    };
}

const chartCandidates = (chart: ChartReferenceLevels): LevelCandidate[] => {
    const entries: { price: number | null; kind: LevelSourceKind }[] = [
        { price: chart.high52w, kind: 'high_52w' },
        { price: chart.low52w, kind: 'low_52w' },
        { price: chart.high20, kind: 'high_20' },
        { price: chart.low20, kind: 'low_20' },
        { price: chart.sma20, kind: 'sma20' },
        { price: chart.sma50, kind: 'sma50' },
        { price: chart.sma200, kind: 'sma200' },
    ];
    return entries.flatMap(({ price, kind }): LevelCandidate[] =>
        price === null ? [] : [{ price, kind }]
    );
};

/**
 * Every price a technical analysis prints, plus the chart references when the caller has them (daily analyses
 * only: the "-day" labels describe daily bars, so the caller passes `null` for an intraday analysis).
 * Analysis: key-level supports, resistances and the volume-profile node, both scenarios' targets, the effective stop loss.
 * Invalid prices are dropped later by `buildLevelLadder`; this only collects.
 */
export function technicalLevelCandidates(
    a: AnalysisResponse | FilteredAnalysisResponse,
    chart: ChartReferenceLevels | null
): LevelCandidate[] {
    const keyLevels = a.keyLevels;
    const poc = keyLevels?.poc;
    const targets = [a.priceTargets?.bullish, a.priceTargets?.bearish].flatMap(
        scenario => scenario?.targets ?? []
    );
    // The effective stop (core's reconciled one first), and none at all when core rejected the model's stop
    // (`reconciledLevels.stopLossRejected`): the raw `stopLoss` is then a level core refused, not a plan price.
    const { stopLoss } = resolveEffectiveActionLevels(
        a.actionRecommendation ?? undefined
    );
    return [
        ...(keyLevels?.support ?? []).map((l): LevelCandidate => ({
            price: l.price,
            kind: 'analysis_support',
        })),
        ...(keyLevels?.resistance ?? []).map((l): LevelCandidate => ({
            price: l.price,
            kind: 'analysis_resistance',
        })),
        ...(poc === undefined
            ? []
            : [{ price: poc.price, kind: 'analysis_poc' } as const]),
        ...targets.map((t): LevelCandidate => ({
            price: t.price,
            kind: 'analysis_target',
        })),
        ...(stopLoss !== undefined
            ? [{ price: stopLoss, kind: 'analysis_stop' } as const]
            : []),
        ...(chart === null ? [] : chartCandidates(chart)),
    ];
}
