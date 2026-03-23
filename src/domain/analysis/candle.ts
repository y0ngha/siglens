import type { Bar } from '@/domain/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CandlePattern =
    // Doji 계열
    | 'flat'
    | 'gravestone_doji'
    | 'dragonfly_doji'
    | 'doji'
    // Marubozu 계열
    | 'bullish_marubozu'
    | 'bearish_marubozu'
    // 단봉 반전
    | 'shooting_star'
    | 'inverted_hammer'
    | 'hammer'
    | 'hanging_man'
    | 'bullish_belt_hold'
    | 'bearish_belt_hold'
    // 기본 형태
    | 'spinning_top'
    | 'bullish'
    | 'bearish';

export type MultiCandlePattern =
    // 상승 반전
    | 'bullish_engulfing'
    | 'bullish_harami'
    | 'bullish_harami_cross'
    | 'piercing_line'
    | 'bullish_counterattack_line'
    | 'morning_star'
    | 'morning_doji_star'
    | 'bullish_abandoned_baby'
    | 'three_white_soldiers'
    | 'three_inside_up'
    | 'three_outside_up'
    | 'bullish_triple_star'
    | 'ladder_bottom'
    | 'tweezers_bottom'
    | 'downside_gap_two_rabbits'
    // 하락 반전
    | 'bearish_engulfing'
    | 'bearish_harami'
    | 'bearish_harami_cross'
    | 'dark_cloud_cover'
    | 'bearish_counterattack_line'
    | 'evening_star'
    | 'evening_doji_star'
    | 'bearish_abandoned_baby'
    | 'three_black_crows'
    | 'three_inside_down'
    | 'three_outside_down'
    | 'bearish_triple_star'
    | 'advance_block'
    | 'tweezers_top'
    | 'upside_gap_two_crows'
    // 지속
    | 'upside_gap_tasuki'
    | 'downside_gap_tasuki'
    | 'on_neck'
    | 'in_neck';

// ─── Constants ────────────────────────────────────────────────────────────────

const DOJI_BODY_RATIO = 0.1;
const DOJI_TAIL_RATIO = 0.1;
const LONG_SHADOW_RATIO = 2;
const SHORT_SHADOW_RATIO = 1;
const MARUBOZU_BODY_RATIO = 0.9;
const SPINNING_TOP_BODY_RATIO = 0.4;
const LONG_DAY_BODY_RATIO = 0.6;
const BELT_HOLD_TAIL_RATIO = 0.1;
const NEAR_PRICE_TOLERANCE = 0.002;
const MIN_PRICE_DENOMINATOR = 1;
const IN_NECK_RATIO = 0.05;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const bodyHigh = (bar: Bar): number => Math.max(bar.open, bar.close);
const bodyLow = (bar: Bar): number => Math.min(bar.open, bar.close);
const bodySize = (bar: Bar): number => Math.abs(bar.close - bar.open);
const calcRange = (bar: Bar): number => bar.high - bar.low;
const upperShadow = (bar: Bar): number => bar.high - bodyHigh(bar);
const lowerShadow = (bar: Bar): number => bodyLow(bar) - bar.low;
const isBullishBar = (bar: Bar): boolean => bar.close >= bar.open;
const isBearishBar = (bar: Bar): boolean => bar.close < bar.open;
const isDojiBar = (bar: Bar): boolean => {
    const range = calcRange(bar);
    return range === 0 || bodySize(bar) / range <= DOJI_BODY_RATIO;
};
const isLongBody = (bar: Bar): boolean => {
    const range = calcRange(bar);
    return range > 0 && bodySize(bar) / range >= LONG_DAY_BODY_RATIO;
};
const isInsideBody = (outer: Bar, inner: Bar): boolean =>
    bodyLow(inner) >= bodyLow(outer) && bodyHigh(inner) <= bodyHigh(outer);
const midpoint = (bar: Bar): number => (bar.open + bar.close) / 2;
const hasGapUp = (prev: Bar, curr: Bar): boolean => curr.low > prev.high;
const hasGapDown = (prev: Bar, curr: Bar): boolean => curr.high < prev.low;
const isNearPrice = (a: number, b: number): boolean =>
    Math.abs(a - b) /
        Math.max(Math.abs(a), Math.abs(b), MIN_PRICE_DENOMINATOR) <=
    NEAR_PRICE_TOLERANCE;

// ─── Single Candle Pattern ────────────────────────────────────────────────────

export function detectCandlePattern(bar: Bar): CandlePattern {
    const range = calcRange(bar);
    if (range === 0) return 'flat';

    const bs = bodySize(bar);
    const bodyRatio = bs / range;
    const upper = upperShadow(bar);
    const lower = lowerShadow(bar);
    const bullish = isBullishBar(bar);

    // Doji 계열
    if (bodyRatio <= DOJI_BODY_RATIO) {
        if (lower <= range * DOJI_TAIL_RATIO) return 'gravestone_doji';
        if (upper <= range * DOJI_TAIL_RATIO) return 'dragonfly_doji';
        return 'doji';
    }

    // Marubozu (꼬리 거의 없음)
    if (bodyRatio >= MARUBOZU_BODY_RATIO)
        return bullish ? 'bullish_marubozu' : 'bearish_marubozu';

    // 긴 위꼬리 + 짧은 아래꼬리
    const hasLongUpper = upper >= bs * LONG_SHADOW_RATIO;
    const hasShortLower = lower <= bs * SHORT_SHADOW_RATIO;
    if (hasLongUpper && hasShortLower)
        return bullish ? 'inverted_hammer' : 'shooting_star';

    // 긴 아래꼬리 + 짧은 위꼬리
    const hasLongLower = lower >= bs * LONG_SHADOW_RATIO;
    const hasShortUpper = upper <= bs * SHORT_SHADOW_RATIO;
    if (hasLongLower && hasShortUpper)
        return bullish ? 'hammer' : 'hanging_man';

    // Belt Hold (긴 몸통, 한쪽 꼬리 없음)
    if (isLongBody(bar)) {
        if (bullish && lower <= bs * BELT_HOLD_TAIL_RATIO)
            return 'bullish_belt_hold';
        if (!bullish && upper <= bs * BELT_HOLD_TAIL_RATIO)
            return 'bearish_belt_hold';
    }

    // Spinning Top (작은 몸통 + 양쪽 꼬리)
    if (bodyRatio <= SPINNING_TOP_BODY_RATIO && upper > 0 && lower > 0)
        return 'spinning_top';

    return bullish ? 'bullish' : 'bearish';
}

// ─── Multi Candle Pattern Helpers ─────────────────────────────────────────────

function detect2CandlePattern(prev: Bar, curr: Bar): MultiCandlePattern | null {
    const prevBull = isBullishBar(prev);
    const prevBear = isBearishBar(prev);
    const currBull = isBullishBar(curr);
    const currBear = isBearishBar(curr);
    const prevLong = isLongBody(prev);

    // Engulfing
    if (
        prevBear &&
        currBull &&
        curr.open <= prev.close &&
        curr.close >= prev.open
    )
        return 'bullish_engulfing';
    if (
        prevBull &&
        currBear &&
        curr.open >= prev.close &&
        curr.close <= prev.open
    )
        return 'bearish_engulfing';

    // Harami
    if (prevBear && prevLong && isInsideBody(prev, curr)) {
        return isDojiBar(curr) ? 'bullish_harami_cross' : 'bullish_harami';
    }
    if (prevBull && prevLong && isInsideBody(prev, curr)) {
        return isDojiBar(curr) ? 'bearish_harami_cross' : 'bearish_harami';
    }

    // Piercing Line / Dark Cloud Cover
    if (
        prevBear &&
        prevLong &&
        currBull &&
        curr.open < prev.close &&
        curr.close > midpoint(prev) &&
        curr.close < prev.open
    )
        return 'piercing_line';

    if (
        prevBull &&
        prevLong &&
        currBear &&
        curr.open > prev.close &&
        curr.close < midpoint(prev) &&
        curr.close > prev.open
    )
        return 'dark_cloud_cover';

    // Counterattack Line
    if (
        prevBear &&
        prevLong &&
        currBull &&
        isLongBody(curr) &&
        isNearPrice(curr.close, prev.close)
    )
        return 'bullish_counterattack_line';
    if (
        prevBull &&
        prevLong &&
        currBear &&
        isLongBody(curr) &&
        isNearPrice(curr.close, prev.close)
    )
        return 'bearish_counterattack_line';

    // Tweezers
    if (isNearPrice(prev.low, curr.low) && prevBear) return 'tweezers_bottom';
    if (isNearPrice(prev.high, curr.high) && prevBull) return 'tweezers_top';

    // On Neck / In Neck
    if (prevBear && prevLong && currBull && curr.open < prev.low) {
        if (isNearPrice(curr.close, prev.low)) return 'on_neck';
        if (
            curr.close > prev.low &&
            curr.close < prev.close * (1 + IN_NECK_RATIO)
        )
            return 'in_neck';
    }

    return null;
}

function detect3CandlePattern(
    a: Bar,
    b: Bar,
    c: Bar
): MultiCandlePattern | null {
    const aBull = isBullishBar(a);
    const aBear = isBearishBar(a);
    const bBull = isBullishBar(b);
    const bBear = isBearishBar(b);
    const cBull = isBullishBar(c);
    const cBear = isBearishBar(c);
    const aLong = isLongBody(a);
    const bLong = isLongBody(b);
    const cLong = isLongBody(c);

    // Three White Soldiers
    if (
        aBull &&
        bBull &&
        cBull &&
        aLong &&
        bLong &&
        cLong &&
        b.open > a.open &&
        b.open < a.close &&
        c.open > b.open &&
        c.open < b.close
    )
        return 'three_white_soldiers';

    // Three Black Crows
    if (
        aBear &&
        bBear &&
        cBear &&
        aLong &&
        bLong &&
        cLong &&
        b.open < a.open &&
        b.open > a.close &&
        c.open < b.open &&
        c.open > b.close
    )
        return 'three_black_crows';

    // Morning Star / Morning Doji Star
    if (
        aBear &&
        aLong &&
        cBull &&
        bodyHigh(b) < bodyLow(a) &&
        c.close > midpoint(a)
    ) {
        return isDojiBar(b) ? 'morning_doji_star' : 'morning_star';
    }

    // Evening Star / Evening Doji Star
    if (
        aBull &&
        aLong &&
        cBear &&
        bodyLow(b) > bodyHigh(a) &&
        c.close < midpoint(a)
    ) {
        return isDojiBar(b) ? 'evening_doji_star' : 'evening_star';
    }

    // Bullish Abandoned Baby
    if (
        aBear &&
        aLong &&
        isDojiBar(b) &&
        cBull &&
        hasGapDown(a, b) &&
        hasGapUp(b, c)
    )
        return 'bullish_abandoned_baby';

    // Bearish Abandoned Baby
    if (
        aBull &&
        aLong &&
        isDojiBar(b) &&
        cBear &&
        hasGapUp(a, b) &&
        hasGapDown(b, c)
    )
        return 'bearish_abandoned_baby';

    // Three Inside Up
    if (
        aBear &&
        aLong &&
        bBull &&
        isInsideBody(a, b) &&
        cBull &&
        c.close > a.open
    )
        return 'three_inside_up';

    // Three Inside Down
    if (
        aBull &&
        aLong &&
        bBear &&
        isInsideBody(a, b) &&
        cBear &&
        c.close < a.open
    )
        return 'three_inside_down';

    // Three Outside Up
    if (
        aBear &&
        bBull &&
        b.close >= a.open &&
        b.open <= a.close &&
        cBull &&
        c.close > b.close
    )
        return 'three_outside_up';

    // Three Outside Down
    if (
        aBull &&
        bBear &&
        b.close <= a.open &&
        b.open >= a.close &&
        cBear &&
        c.close < b.close
    )
        return 'three_outside_down';

    // Bullish Triple Star
    if (
        isDojiBar(a) &&
        isDojiBar(b) &&
        isDojiBar(c) &&
        hasGapDown(a, b) &&
        cBull
    )
        return 'bullish_triple_star';

    // Bearish Triple Star
    if (isDojiBar(a) && isDojiBar(b) && isDojiBar(c) && hasGapUp(a, b) && cBear)
        return 'bearish_triple_star';

    // Upside Gap Two Crows
    if (
        aBull &&
        aLong &&
        bBear &&
        cBear &&
        bodyLow(b) > bodyHigh(a) &&
        c.open <= b.open &&
        c.close <= b.close &&
        c.open > bodyHigh(a)
    )
        return 'upside_gap_two_crows';

    // Downside Gap Two Rabbits
    if (
        aBear &&
        aLong &&
        bBull &&
        cBull &&
        bodyHigh(b) < bodyLow(a) &&
        c.open >= b.open &&
        c.close >= b.close &&
        c.open < bodyLow(a)
    )
        return 'downside_gap_two_rabbits';

    // Advance Block
    if (
        aBull &&
        bBull &&
        cBull &&
        aLong &&
        bodySize(b) < bodySize(a) &&
        bodySize(c) < bodySize(b) &&
        upperShadow(b) > upperShadow(a) &&
        upperShadow(c) > upperShadow(b)
    )
        return 'advance_block';

    // Upside Gap Tasuki
    if (
        aBull &&
        bBull &&
        cBear &&
        b.low > a.high &&
        c.open < b.close &&
        c.close > a.high
    )
        return 'upside_gap_tasuki';

    // Downside Gap Tasuki
    if (
        aBear &&
        bBear &&
        cBull &&
        b.high < a.low &&
        c.open > b.close &&
        c.close < a.low
    )
        return 'downside_gap_tasuki';

    // Ladder Bottom
    if (
        aBear &&
        bBear &&
        cBull &&
        bLong &&
        b.open < a.open &&
        b.open > a.close &&
        c.open > b.open &&
        c.close > a.open
    )
        return 'ladder_bottom';

    return null;
}

// ─── Multi Candle Pattern ─────────────────────────────────────────────────────

export function detectMultiCandlePattern(
    bars: Bar[]
): MultiCandlePattern | null {
    if (bars.length < 2) return null;

    const last = bars[bars.length - 1];
    const prev = bars[bars.length - 2];

    if (bars.length >= 3) {
        const prev2 = bars[bars.length - 3];
        const result = detect3CandlePattern(prev2, prev, last);
        if (result !== null) return result;
    }

    return detect2CandlePattern(prev, last);
}
