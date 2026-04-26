/**
 * Smart Money Concepts (SMC) Indicator
 *
 * Concept reference:
 *   Smart Money Concepts (SMC) / ICT (Inner Circle Trader) methodology
 *
 * Original TradingView indicator:
 *   "Smart Money Concepts [LuxAlgo]" by LuxAlgo
 *   https://kr.tradingview.com/script/CnB3fSph-Smart-Money-Concepts-SMC-LuxAlgo/
 *   Licensed under CC BY-NC-SA 4.0
 *   © LuxAlgo
 *
 * This file is an INDEPENDENT TypeScript implementation of publicly documented
 * SMC/ICT trading concepts. It does not copy or directly port any source code
 * from the LuxAlgo PineScript indicator. The algorithms are derived from the
 * publicly available SMC methodology documentation.
 */

import type {
    Bar,
    SMCBreakType,
    SMCEqualLevel,
    SMCFairValueGap,
    SMCOrderBlock,
    SMCResult,
    SMCStructureBreak,
    SMCStructureDirection,
    SMCSwingPoint,
    SMCSwingPointType,
} from '@/domain/types';
import {
    EMPTY_SMC_RESULT,
    SMC_ATR_PERIOD,
    SMC_DISCOUNT_RATIO,
    SMC_EQUAL_LEVEL_ATR_MULTIPLIER,
    SMC_PREMIUM_RATIO,
    SMC_SWING_PERIOD,
} from '@y0ngha/siglens-core';
import { calculateATR } from '@/domain/indicators/atr';

// ─── Swing detection ─────────────────────────────────────────────────────────

/**
 * Detect swing highs and swing lows from bar data.
 *
 * A bar at index i is a swing high if its high is the maximum in the window
 * [i - period, i + period]. A swing low uses the minimum. Only bars with at
 * least `period` neighbours on both sides qualify as pivots.
 */
function detectSwingPoints(bars: Bar[], period: number): SMCSwingPoint[] {
    if (bars.length < period * 2 + 1) return [];

    return bars
        .map((bar, i) => {
            if (i < period || i >= bars.length - period) return null;

            const window = bars.slice(i - period, i + period + 1);
            const maxHigh = window.reduce(
                (m, b) => Math.max(m, b.high),
                -Infinity
            );
            const minLow = window.reduce(
                (m, b) => Math.min(m, b.low),
                Infinity
            );

            const found: SMCSwingPoint[] = [];
            if (bar.high === maxHigh)
                found.push({ index: i, price: bar.high, type: 'high' });
            if (bar.low === minLow)
                found.push({ index: i, price: bar.low, type: 'low' });

            return found.length > 0 ? found : null;
        })
        .filter((points): points is SMCSwingPoint[] => points !== null)
        .flat();
}

// ─── Fair Value Gap detection ─────────────────────────────────────────────────

/**
 * Detect Fair Value Gaps (FVGs / price imbalances).
 *
 * Bullish FVG at bar i: bars[i].low > bars[i-2].high
 *   → gap zone: [bars[i-2].high (low), bars[i].low (high)]
 *   → mitigated when a later bar's low touches the top of the gap
 *
 * Bearish FVG at bar i: bars[i].high < bars[i-2].low
 *   → gap zone: [bars[i].high (low), bars[i-2].low (high)]
 *   → mitigated when a later bar's high touches the bottom of the gap
 */
function detectFairValueGaps(bars: Bar[]): SMCFairValueGap[] {
    if (bars.length < 3) return [];

    const raw = bars
        .slice(2)
        .map((bar, idx): SMCFairValueGap | null => {
            const i = idx + 2;
            const anchor = bars[i - 2];

            const isBullish = bar.low > anchor.high;
            const isBearish = bar.high < anchor.low;

            if (!isBullish && !isBearish) return null;

            return isBullish
                ? {
                      index: i,
                      high: bar.low,
                      low: anchor.high,
                      type: 'bullish',
                      isMitigated: false,
                  }
                : {
                      index: i,
                      high: anchor.low,
                      low: bar.high,
                      type: 'bearish',
                      isMitigated: false,
                  };
        })
        .filter((fvg): fvg is SMCFairValueGap => fvg !== null);

    return raw.map(fvg => ({
        ...fvg,
        isMitigated: bars.some(
            (b, idx) =>
                idx > fvg.index &&
                (fvg.type === 'bullish' ? b.low <= fvg.high : b.high >= fvg.low)
        ),
    }));
}

// ─── Structure break detection (BOS / CHoCH) ─────────────────────────────────

interface SwingAdvanceResult {
    nextIdx: number;
    active: SMCSwingPoint | null;
    wasUpdated: boolean;
}

/**
 * Advance the active swing pointer to the most recent confirmed pivot
 * at or before `barIndex`. Returns the updated pointer index, active swing,
 * and whether the active swing was replaced (requiring consumed-flag reset).
 */
function advanceActiveSwing(
    swings: SMCSwingPoint[],
    startIdx: number,
    barIndex: number,
    currentActive: SMCSwingPoint | null
): SwingAdvanceResult {
    let idx = startIdx;
    let active = currentActive;
    let wasUpdated = false;

    while (idx < swings.length && swings[idx].index <= barIndex) {
        if (active === null || swings[idx].index > active.index) {
            active = swings[idx];
            wasUpdated = true;
        }
        idx++;
    }

    return { nextIdx: idx, active, wasUpdated };
}

/**
 * Detect BOS (Break of Structure) and CHoCH (Change of Character).
 *
 * State machine rules:
 *  - BOS:   close crosses the active swing level in the SAME direction as
 *           the current trend (structural continuation).
 *  - CHoCH: close crosses the active swing level in the OPPOSITE direction
 *           (potential trend reversal — the first counter-trend break).
 *
 * Active swing levels are updated as new pivots become confirmed over time.
 * A level is consumed (marked broken) upon the first close beyond it.
 *
 * Note: for loops are used here because the algorithm relies on two
 * independent advancing pointers (highIdx, lowIdx) over sorted swing arrays,
 * which cannot be expressed cleanly as map/reduce without sacrificing clarity.
 */
function detectStructureBreaks(
    bars: Bar[],
    swingHighs: SMCSwingPoint[],
    swingLows: SMCSwingPoint[]
): SMCStructureBreak[] {
    if (swingHighs.length === 0 || swingLows.length === 0) return [];

    let trend: SMCStructureDirection | null = null;
    let activeHigh: SMCSwingPoint | null = null;
    let activeLow: SMCSwingPoint | null = null;
    let highConsumed = false;
    let lowConsumed = false;
    let breaks: SMCStructureBreak[] = [];
    let highIdx = 0;
    let lowIdx = 0;

    for (let i = 0; i < bars.length; i++) {
        const bar = bars[i];

        const highResult = advanceActiveSwing(
            swingHighs,
            highIdx,
            i,
            activeHigh
        );
        highIdx = highResult.nextIdx;
        activeHigh = highResult.active;
        if (highResult.wasUpdated) highConsumed = false;

        const lowResult = advanceActiveSwing(swingLows, lowIdx, i, activeLow);
        lowIdx = lowResult.nextIdx;
        activeLow = lowResult.active;
        if (lowResult.wasUpdated) lowConsumed = false;

        // Bullish break: close crosses above the active swing high
        if (
            activeHigh !== null &&
            !highConsumed &&
            bar.close > activeHigh.price
        ) {
            const breakType: SMCBreakType =
                trend === 'bearish' ? 'choch' : 'bos';
            breaks = [
                ...breaks,
                {
                    index: i,
                    price: activeHigh.price,
                    type: 'bullish',
                    breakType,
                },
            ];
            trend = 'bullish';
            highConsumed = true;
        }

        // Bearish break: close crosses below the active swing low
        if (activeLow !== null && !lowConsumed && bar.close < activeLow.price) {
            const breakType: SMCBreakType =
                trend === 'bullish' ? 'choch' : 'bos';
            breaks = [
                ...breaks,
                {
                    index: i,
                    price: activeLow.price,
                    type: 'bearish',
                    breakType,
                },
            ];
            trend = 'bearish';
            lowConsumed = true;
        }
    }

    return breaks;
}

// ─── Order Block detection ────────────────────────────────────────────────────

interface LastOpposingIndices {
    lastBullish: (number | null)[];
    lastBearish: (number | null)[];
}

/**
 * Precompute the index of the last bullish and bearish candle at or before
 * each bar index in a single O(n) forward pass.
 */
function* scanLastIndex(
    bars: Bar[],
    pred: (bar: Bar) => boolean
): Generator<number | null> {
    let last: number | null = null;
    for (let i = 0; i < bars.length; i++) {
        if (pred(bars[i])) last = i;
        yield last;
    }
}

function buildLastOpposingIndices(bars: Bar[]): LastOpposingIndices {
    return {
        lastBullish: [...scanLastIndex(bars, bar => bar.close > bar.open)],
        lastBearish: [...scanLastIndex(bars, bar => bar.close < bar.open)],
    };
}

/**
 * Detect Order Blocks (OBs).
 *
 * For each confirmed structure break, the order block is the last candle
 * whose body direction is OPPOSITE to the break direction, found in the
 * bars leading up to the break.
 *
 *  - Bullish break → last bearish candle (close < open) before break index
 *  - Bearish break → last bullish candle (close > open) before break index
 *
 * Mitigation: price subsequently crosses through the OB zone entirely
 * (low goes below OB.low for bullish OB, high goes above OB.high for bearish OB).
 */
function detectOrderBlocks(
    bars: Bar[],
    structureBreaks: SMCStructureBreak[]
): SMCOrderBlock[] {
    if (structureBreaks.length === 0) return [];

    const { lastBullish, lastBearish } = buildLastOpposingIndices(bars);

    return structureBreaks.reduce<SMCOrderBlock[]>((acc, sb) => {
        if (sb.index === 0) return acc;

        const isBullishBreak = sb.type === 'bullish';
        // Bullish break → last bearish candle; Bearish break → last bullish candle
        const obIndex = isBullishBreak
            ? lastBearish[sb.index - 1]
            : lastBullish[sb.index - 1];
        if (obIndex === null) return acc;

        const obBar = bars[obIndex];
        const ob: SMCOrderBlock = {
            startIndex: obIndex,
            high: obBar.high,
            low: obBar.low,
            type: sb.type,
            isMitigated: bars
                .slice(obIndex + 1)
                .some(b =>
                    isBullishBreak ? b.low < obBar.low : b.high > obBar.high
                ),
        };

        return [...acc, ob];
    }, []);
}

// ─── Equal High / Low detection ───────────────────────────────────────────────

/**
 * Detect Equal Highs and Equal Lows (EQH / EQL).
 *
 * Two swing highs (or lows) are considered "equal" when their prices are
 * within `SMC_EQUAL_LEVEL_ATR_MULTIPLIER × ATR` of each other at the time
 * of the earlier pivot.
 */
function detectEqualLevels(
    swingHighs: SMCSwingPoint[],
    swingLows: SMCSwingPoint[],
    atrValues: (number | null)[]
): { equalHighs: SMCEqualLevel[]; equalLows: SMCEqualLevel[] } {
    return {
        equalHighs: findEqualLevels(swingHighs, atrValues, 'high'),
        equalLows: findEqualLevels(swingLows, atrValues, 'low'),
    };
}

function* findMatchingLevels(
    swings: SMCSwingPoint[],
    startJ: number,
    swing: SMCSwingPoint,
    threshold: number,
    type: SMCSwingPointType
): Generator<SMCEqualLevel> {
    for (let j = startJ; j < swings.length; j++) {
        if (Math.abs(swings[j].price - swing.price) <= threshold) {
            yield {
                price: (swing.price + swings[j].price) / 2,
                firstIndex: swing.index,
                secondIndex: swings[j].index,
                type,
            };
        }
    }
}

function findEqualLevels(
    swings: SMCSwingPoint[],
    atrValues: (number | null)[],
    type: SMCSwingPointType
): SMCEqualLevel[] {
    return swings.flatMap((swing, i) => {
        const atr = atrValues[swing.index];
        if (atr === null) return [];

        const threshold = SMC_EQUAL_LEVEL_ATR_MULTIPLIER * atr;
        return [...findMatchingLevels(swings, i + 1, swing, threshold, type)];
    });
}

// ─── Premium / Discount / Equilibrium zones ───────────────────────────────────

// detectZones 가 사용하는 내부 range 표현. 외부에 노출되지 않는 구현 전용
// 타입이므로 domain/types.ts 가 아닌 본 파일에 둔다 (indicator 결과 타입만
// types.ts 에 배치하는 ARCHITECTURE.md 규칙에 부합).
interface ZoneRange {
    top: number;
    bottom: number;
}

/**
 * Resolve the structural range used to compute Premium/Discount/Equilibrium
 * zones. ICT-style SMC reads the "current range" relative to the most recent
 * confirmed structure break:
 *
 *  - Bullish BOS/CHoCH: the broken swing high anchors the range top; the
 *    range bottom is the lowest swing low formed since the break (falling
 *    back to swing lows that formed immediately before the break when no
 *    post-break pullback low exists yet).
 *  - Bearish BOS/CHoCH: symmetric — the broken swing low anchors the bottom
 *    and the highest swing high since the break anchors the top.
 *  - No structure break yet: use the extremes of all detected swings as a
 *    pragmatic fallback. This covers early-warmup and consolidation cases
 *    where no directional commitment has formed.
 *
 * Returns null when the relevant swing arrays are empty and no anchor can be
 * established. The zone builder treats a non-positive span as "no range".
 */
function resolveZoneRange(
    swingHighs: SMCSwingPoint[],
    swingLows: SMCSwingPoint[],
    structureBreaks: SMCStructureBreak[]
): ZoneRange | null {
    const lastBreak = structureBreaks[structureBreaks.length - 1];

    if (lastBreak === undefined) {
        if (swingHighs.length === 0 || swingLows.length === 0) return null;
        return {
            top: swingHighs.reduce((m, s) => Math.max(m, s.price), -Infinity),
            bottom: swingLows.reduce((m, s) => Math.min(m, s.price), Infinity),
        };
    }

    if (lastBreak.type === 'bullish') {
        const lowsAfter = swingLows.filter(s => s.index > lastBreak.index);
        const lowsBefore = swingLows.filter(s => s.index <= lastBreak.index);
        const relevantLows = lowsAfter.length > 0 ? lowsAfter : lowsBefore;
        if (relevantLows.length === 0) return null;

        const highsAfter = swingHighs.filter(s => s.index >= lastBreak.index);
        const highPrices = [lastBreak.price, ...highsAfter.map(s => s.price)];

        return {
            top: highPrices.reduce((m, p) => Math.max(m, p), -Infinity),
            bottom: relevantLows.reduce(
                (m, s) => Math.min(m, s.price),
                Infinity
            ),
        };
    }

    // bearish break
    const highsAfter = swingHighs.filter(s => s.index > lastBreak.index);
    const highsBefore = swingHighs.filter(s => s.index <= lastBreak.index);
    const relevantHighs = highsAfter.length > 0 ? highsAfter : highsBefore;
    if (relevantHighs.length === 0) return null;

    const lowsAfter = swingLows.filter(s => s.index >= lastBreak.index);
    const lowPrices = [lastBreak.price, ...lowsAfter.map(s => s.price)];

    return {
        top: relevantHighs.reduce((m, s) => Math.max(m, s.price), -Infinity),
        bottom: lowPrices.reduce((m, p) => Math.min(m, p), Infinity),
    };
}

/**
 * Calculate Premium, Discount, and Equilibrium zones from the active
 * structural range (see `resolveZoneRange` for the range derivation rules).
 *
 *  - Premium zone:     top 25% of the range  → price is relatively expensive
 *  - Equilibrium zone: middle 50% of the range
 *  - Discount zone:    bottom 25% of the range → price is relatively cheap
 */
function detectZones(
    swingHighs: SMCSwingPoint[],
    swingLows: SMCSwingPoint[],
    structureBreaks: SMCStructureBreak[]
): Pick<SMCResult, 'premiumZone' | 'discountZone' | 'equilibriumZone'> {
    const empty = {
        premiumZone: null,
        discountZone: null,
        equilibriumZone: null,
    };

    const resolved = resolveZoneRange(swingHighs, swingLows, structureBreaks);
    if (resolved === null) return empty;

    const { top, bottom } = resolved;
    const span = top - bottom;
    if (span <= 0) return empty;

    return {
        premiumZone: {
            high: top,
            low: bottom + SMC_PREMIUM_RATIO * span,
            type: 'premium',
        },
        equilibriumZone: {
            high: bottom + SMC_PREMIUM_RATIO * span,
            low: bottom + SMC_DISCOUNT_RATIO * span,
            type: 'equilibrium',
        },
        discountZone: {
            high: bottom + SMC_DISCOUNT_RATIO * span,
            low: bottom,
            type: 'discount',
        },
    };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function calculateSmc(
    bars: Bar[],
    swingPeriod = SMC_SWING_PERIOD
): SMCResult {
    if (bars.length === 0) return EMPTY_SMC_RESULT;

    const atrValues = calculateATR(bars, SMC_ATR_PERIOD);
    const swingPoints = detectSwingPoints(bars, swingPeriod);
    const swingHighs = swingPoints.filter(p => p.type === 'high');
    const swingLows = swingPoints.filter(p => p.type === 'low');

    const fairValueGaps = detectFairValueGaps(bars);
    const structureBreaks = detectStructureBreaks(bars, swingHighs, swingLows);
    const orderBlocks = detectOrderBlocks(bars, structureBreaks);
    const { equalHighs, equalLows } = detectEqualLevels(
        swingHighs,
        swingLows,
        atrValues
    );
    const { premiumZone, discountZone, equilibriumZone } = detectZones(
        swingHighs,
        swingLows,
        structureBreaks
    );

    return {
        swingHighs,
        swingLows,
        orderBlocks,
        fairValueGaps,
        equalHighs,
        equalLows,
        premiumZone,
        discountZone,
        equilibriumZone,
        structureBreaks,
    };
}
