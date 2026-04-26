import type {
    CandlePattern,
    MultiCandlePattern,
    PatternTrend,
} from '@/domain/types';

// ─── Pattern Classification Sets ─────────────────────────────────────────────

const BULLISH_SINGLE_PATTERNS: ReadonlySet<CandlePattern> = new Set([
    'hammer',
    'inverted_hammer',
    'bullish_marubozu',
    'bullish_belt_hold',
    'dragonfly_doji',
]);

const BEARISH_SINGLE_PATTERNS: ReadonlySet<CandlePattern> = new Set([
    'shooting_star',
    'hanging_man',
    'bearish_marubozu',
    'bearish_belt_hold',
    'gravestone_doji',
]);

const BULLISH_MULTI_PATTERNS: ReadonlySet<MultiCandlePattern> = new Set([
    'bullish_engulfing',
    'bullish_harami',
    'bullish_harami_cross',
    'piercing_line',
    'bullish_counterattack_line',
    'morning_star',
    'morning_doji_star',
    'bullish_abandoned_baby',
    'three_white_soldiers',
    'three_inside_up',
    'three_outside_up',
    'bullish_triple_star',
    'ladder_bottom',
    'tweezers_bottom',
    'downside_gap_two_rabbits',
]);

const BEARISH_MULTI_PATTERNS: ReadonlySet<MultiCandlePattern> = new Set([
    'bearish_engulfing',
    'bearish_harami',
    'bearish_harami_cross',
    'dark_cloud_cover',
    'bearish_counterattack_line',
    'evening_star',
    'evening_doji_star',
    'bearish_abandoned_baby',
    'three_black_crows',
    'three_inside_down',
    'three_outside_down',
    'bearish_triple_star',
    'advance_block',
    'tweezers_top',
    'upside_gap_two_crows',
]);

export const EXCLUDED_SINGLE_PATTERNS: ReadonlySet<CandlePattern> = new Set([
    'bullish',
    'bearish',
    'flat',
    'spinning_top',
]);

// ─── Trend Classification Functions ──────────────────────────────────────────

export function getSinglePatternTrend(pattern: CandlePattern): PatternTrend {
    if (BULLISH_SINGLE_PATTERNS.has(pattern)) return 'bullish';
    if (BEARISH_SINGLE_PATTERNS.has(pattern)) return 'bearish';
    return 'neutral';
}

export function getMultiPatternTrend(
    pattern: MultiCandlePattern
): PatternTrend {
    if (BULLISH_MULTI_PATTERNS.has(pattern)) return 'bullish';
    if (BEARISH_MULTI_PATTERNS.has(pattern)) return 'bearish';
    return 'neutral';
}
