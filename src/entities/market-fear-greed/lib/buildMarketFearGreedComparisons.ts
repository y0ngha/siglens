import type { FearGreedLabel } from '@y0ngha/siglens-core';
import { MS_PER_DAY } from '@/shared/config/time';
import type {
    FearGreedLookbackPoint,
    MarketFearGreedComparisonKey,
    MarketFearGreedComparisonPoint,
} from '../model';

/**
 * One walk-forward history point. Typed structurally so the market
 * (`MarketFearGreedHistoryPoint`) and crypto (`FearGreedHistoryPoint`) histories
 * both fit without a cast — they share the `{ date, score, label }` shape.
 */
interface HistoryPoint {
    date: string;
    score: number | null;
    label: FearGreedLabel | null;
}

type ScoredPoint = HistoryPoint & { score: number; label: FearGreedLabel };

/** Warm-up points carry `null`; only fully scored points can be compared. */
function scoredPoints(history: readonly HistoryPoint[]): ScoredPoint[] {
    return history.filter(
        (point): point is ScoredPoint =>
            point.score !== null && point.label !== null
    );
}

function toComparison(
    key: MarketFearGreedComparisonKey,
    point: ScoredPoint
): MarketFearGreedComparisonPoint {
    return { key, date: point.date, score: point.score, label: point.label };
}

/**
 * 1년에 해당하는 거래 세션 수. "1년 전" 비교 기준점이고, 종목 페이지의 "최근 1년" 차트도
 * 같은 값으로 잘라 그린다 — 두 값이 어긋나면 차트 첫 점과 "1년 전" 게이지가 다른 날을 가리킨다.
 */
export const FEAR_GREED_SESSIONS_PER_YEAR = 252;

/**
 * Lookbacks in trading sessions, matching the per-stock page's gauges so the
 * two Fear & Greed surfaces read the same way: ~5 sessions a week, ~21 a month,
 * ~252 a year.
 */
const COMPARISON_OFFSETS = [
    { key: 'now', sessionsBack: 0 },
    { key: '1w', sessionsBack: 5 },
    { key: '1m', sessionsBack: 21 },
    { key: '1y', sessionsBack: FEAR_GREED_SESSIONS_PER_YEAR },
] as const satisfies ReadonlyArray<{
    key: MarketFearGreedComparisonKey;
    sessionsBack: number;
}>;

/**
 * Resolve a walk-forward history to the four session lookbacks, flagging the
 * ones the history is too short to reach.
 *
 * Shared by every Fear & Greed surface that compares "now" with past sessions
 * (the market pages and the per-symbol gauges), so they all count lookbacks the
 * same way.
 *
 * Warm-up points carry a `null` score, so offsets are counted over *scored*
 * sessions only — otherwise "1 year ago" could land in the warm-up window and
 * silently disappear. When the history is shorter than a lookback the index is
 * clamped to the earliest scored session; `clamped` is set and `date` tells the
 * caller which session it actually got.
 *
 * @param history - Walk-forward history, ascending by date.
 * @returns Four points, or an empty array when nothing is scored yet.
 */
export function resolveSessionComparisons(
    history: readonly HistoryPoint[]
): FearGreedLookbackPoint[] {
    const scored = scoredPoints(history);
    if (scored.length === 0) return [];

    const latest = scored.length - 1;

    return COMPARISON_OFFSETS.map(({ key, sessionsBack }) => ({
        ...toComparison(key, scored[Math.max(0, latest - sessionsBack)]),
        clamped: sessionsBack > latest,
    }));
}

/**
 * Reduce a walk-forward history to the four readings the market page shows.
 * Same lookbacks as {@link resolveSessionComparisons}, without the `clamped` flag.
 *
 * @param history - Walk-forward history, ascending by date.
 * @returns Four points, or an empty array when nothing is scored yet.
 */
export function buildMarketFearGreedComparisons(
    history: readonly HistoryPoint[]
): MarketFearGreedComparisonPoint[] {
    return resolveSessionComparisons(history).map(
        ({ key, date, score, label }) => ({ key, date, score, label })
    );
}

/** Lookbacks in calendar days, for a market that trades every day (crypto). */
const CALENDAR_COMPARISON_OFFSETS = [
    { key: 'now', daysBack: 0 },
    { key: '1w', daysBack: 7 },
    { key: '1m', daysBack: 30 },
    { key: '1y', daysBack: 365 },
] as const satisfies ReadonlyArray<{
    key: MarketFearGreedComparisonKey;
    daysBack: number;
}>;

/**
 * Calendar-day variant of {@link buildMarketFearGreedComparisons}.
 *
 * Crypto trades seven days a week, so "1 week ago" is the same weekday seven
 * calendar days back rather than five sessions. Offsets are resolved by date,
 * not by index: a day dropped by the inner join (one coin missing a bar) would
 * otherwise shift every lookback by a day. Each lookback takes the latest scored
 * point on or before its target date, clamped to the earliest scored point.
 *
 * @param history - Walk-forward history, ascending by date.
 * @returns Four points, or an empty array when nothing is scored yet.
 */
export function buildCalendarDayComparisons(
    history: readonly HistoryPoint[]
): MarketFearGreedComparisonPoint[] {
    const scored = scoredPoints(history);
    if (scored.length === 0) return [];

    const latestMs = Date.parse(scored[scored.length - 1].date);

    return CALENDAR_COMPARISON_OFFSETS.map(({ key, daysBack }) => {
        const target = new Date(latestMs - daysBack * MS_PER_DAY)
            .toISOString()
            .slice(0, 10);
        const point = scored.findLast(p => p.date <= target) ?? scored[0];
        return toComparison(key, point);
    });
}
