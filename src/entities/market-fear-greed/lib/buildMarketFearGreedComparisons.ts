import type { MarketFearGreedHistoryPoint } from '@y0ngha/siglens-core';
import type {
    MarketFearGreedComparisonKey,
    MarketFearGreedComparisonPoint,
} from '../model';

/**
 * Lookbacks in trading sessions, matching the per-stock page's gauges so the
 * two Fear & Greed surfaces read the same way: ~5 sessions a week, ~21 a month,
 * ~252 a year.
 */
const COMPARISON_OFFSETS = [
    { key: 'now', sessionsBack: 0 },
    { key: '1w', sessionsBack: 5 },
    { key: '1m', sessionsBack: 21 },
    { key: '1y', sessionsBack: 252 },
] as const satisfies ReadonlyArray<{
    key: MarketFearGreedComparisonKey;
    sessionsBack: number;
}>;

/**
 * Reduce a walk-forward history to the four readings the page shows.
 *
 * Warm-up points carry a `null` score, so offsets are counted over *scored*
 * sessions only — otherwise "1 year ago" could land in the warm-up window and
 * silently disappear. When the history is shorter than a lookback the index is
 * clamped to the earliest scored session, and the returned `date` tells the
 * caller which session it actually got.
 *
 * @param history - Walk-forward history, ascending by date.
 * @returns Four points, or an empty array when nothing is scored yet.
 */
export function buildMarketFearGreedComparisons(
    history: MarketFearGreedHistoryPoint[]
): MarketFearGreedComparisonPoint[] {
    const scored = history.filter(
        (point): point is MarketFearGreedHistoryPoint & { score: number } =>
            point.score !== null && point.label !== null
    );
    if (scored.length === 0) return [];

    const latest = scored.length - 1;

    return COMPARISON_OFFSETS.map(({ key, sessionsBack }) => {
        const point = scored[Math.max(0, latest - sessionsBack)];
        return {
            key,
            date: point.date,
            score: point.score,
            // Safe: `scored` is filtered to points whose label is non-null.
            label: point.label as NonNullable<typeof point.label>,
        };
    });
}
