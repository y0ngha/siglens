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
    SMCResult,
    SMCSwingPoint,
    SMCSwingPointType,
    SMCOrderBlock,
    SMCFairValueGap,
    SMCEqualLevel,
    SMCStructureBreak,
    SMCStructureDirection,
    SMCBreakType,
} from '@/domain/types';
import {
    SMC_SWING_PERIOD,
    SMC_EQUAL_LEVEL_ATR_MULTIPLIER,
    SMC_ATR_PERIOD,
    SMC_PREMIUM_RATIO,
    SMC_DISCOUNT_RATIO,
    EMPTY_SMC_RESULT,
} from '@/domain/indicators/constants';
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

/**
 * Calculate Premium, Discount, and Equilibrium zones from the most recent
 * swing range (last confirmed swing high and swing low).
 *
 *  - Premium zone:     top 25% of the range  → price is relatively expensive
 *  - Equilibrium zone: middle 50% of the range
 *  - Discount zone:    bottom 25% of the range → price is relatively cheap
 *
 * Limitation: swingHighs and swingLows are independent arrays, and the zone
 * range is built by combining their latest entries. The two swings are not
 * guaranteed to belong to the same confirmed cycle (e.g., after a CHoCH the
 * most recent high may precede the most recent low or vice versa). Treat the
 * resulting zones as a pragmatic heuristic rather than a strict ICT range.
 * See skills/indicators/smart-money-concepts.md caveats for details.
 */
function detectZones(
    swingHighs: SMCSwingPoint[],
    swingLows: SMCSwingPoint[]
): Pick<SMCResult, 'premiumZone' | 'discountZone' | 'equilibriumZone'> {
    const empty = {
        premiumZone: null,
        discountZone: null,
        equilibriumZone: null,
    };

    if (swingHighs.length === 0 || swingLows.length === 0) return empty;

    const lastHigh = swingHighs[swingHighs.length - 1];
    const lastLow = swingLows[swingLows.length - 1];
    const rangeTop = Math.max(lastHigh.price, lastLow.price);
    const rangeBottom = Math.min(lastHigh.price, lastLow.price);
    const range = rangeTop - rangeBottom;

    if (range <= 0) return empty;

    return {
        premiumZone: {
            high: rangeTop,
            low: rangeBottom + SMC_PREMIUM_RATIO * range,
            type: 'premium',
        },
        equilibriumZone: {
            high: rangeBottom + SMC_PREMIUM_RATIO * range,
            low: rangeBottom + SMC_DISCOUNT_RATIO * range,
            type: 'equilibrium',
        },
        discountZone: {
            high: rangeBottom + SMC_DISCOUNT_RATIO * range,
            low: rangeBottom,
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
        swingLows
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
