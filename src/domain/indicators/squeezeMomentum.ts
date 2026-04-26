// ─── Squeeze Momentum Indicator ─────────────────────────────────────────────
// Original concept: "Squeeze Momentum Indicator [LazyBear]" by LazyBear
// PineScript source: https://kr.tradingview.com/script/nqQ1DT5a-Squeeze-Momentum-Indicator-LazyBear/
// This is an independent TypeScript implementation based on the publicly
// documented algorithm. Not a direct port of the PineScript source code.
//
// Algorithm:
//   BB: basis = SMA(close, length), dev = kcMult * stdDev(close, length)
//       (Note: uses kcMult=1.5 for BB dev — faithful to the original script)
//   KC: ma = SMA(close, kcLength), rangema = SMA(trueRange, kcLength)
//       upper/lower = ma ± rangema * kcMult
//   sqzOn  = lowerBB > lowerKC AND upperBB < upperKC  (BB inside KC)
//   sqzOff = lowerBB < lowerKC AND upperBB > upperKC  (BB outside KC)
//   noSqz  = NOT sqzOn AND NOT sqzOff
//   momentum = linreg(close - avg(avg(highest(high, n), lowest(low, n)), SMA(close, n)), n, 0)
// ─────────────────────────────────────────────────────────────────────────────

import type { Bar, SqueezeMomentumResult } from '@/domain/types';
import {
    SQUEEZE_MOMENTUM_BB_LENGTH,
    SQUEEZE_MOMENTUM_KC_LENGTH,
    SQUEEZE_MOMENTUM_KC_MULT,
} from '@/domain/indicators/constants';
import { linreg, rollingHighest, rollingLowest, sma, stdDev } from './utils';

type BarComputed = Omit<SqueezeMomentumResult, 'increasing'>;

const NULL_COMPUTED: BarComputed = {
    momentum: null,
    sqzOn: null,
    sqzOff: null,
    noSqz: null,
};

function trueRangeAt(bar: Bar, prev: Bar): number {
    return Math.max(
        bar.high - bar.low,
        Math.abs(bar.high - prev.close),
        Math.abs(bar.low - prev.close)
    );
}

export function calculateSqueezeMomentum(
    bars: Bar[],
    bbLength = SQUEEZE_MOMENTUM_BB_LENGTH,
    kcLength = SQUEEZE_MOMENTUM_KC_LENGTH,
    kcMult = SQUEEZE_MOMENTUM_KC_MULT
): SqueezeMomentumResult[] {
    if (bars.length === 0) return [];

    const closes = bars.map(b => b.close);
    const highs = bars.map(b => b.high);
    const lows = bars.map(b => b.low);

    // Precompute true range for each bar (bar 0 has no previous bar).
    // trValues[i] corresponds to bars[i+1] (i.e., trValues has length bars.length - 1).
    const trValues: number[] = bars
        .slice(1)
        .map((bar, i) => trueRangeAt(bar, bars[i]));

    // Precompute per-bar delta values for the linreg input (O(n) pass).
    // delta[i] = close[i] - avg(avg(highest(high, n), lowest(low, n)), sma(close, n))
    const deltas: (number | null)[] = bars.map((_, i) => {
        if (i < kcLength - 1) return null;
        const highestHigh = rollingHighest(
            highs.slice(i - kcLength + 1, i + 1),
            kcLength
        )!;
        const lowestLow = rollingLowest(
            lows.slice(i - kcLength + 1, i + 1),
            kcLength
        )!;
        const closeSma = sma(closes.slice(i - kcLength + 1, i + 1), kcLength)!;
        return closes[i] - ((highestHigh + lowestLow) / 2 + closeSma) / 2;
    });

    const maxPeriod = Math.max(bbLength, kcLength);

    // Pass 1: compute momentum + squeeze state for each bar (no increasing yet).
    const intermediate: BarComputed[] = bars.map((_, i) => {
        const closesWindow = closes.slice(
            Math.max(0, i - maxPeriod + 1),
            i + 1
        );
        // trValues covers bars[1..n-1]; for bar i we need TR values for bars[1..i],
        // which corresponds to trValues[0..i-1] (length = i).
        const trWindow = trValues.slice(Math.max(0, i - maxPeriod), i);

        // ── Bollinger Bands ──────────────────────────────────────────────────
        const basis = sma(closesWindow, bbLength);
        const sd = stdDev(closesWindow, bbLength);
        if (basis === null || sd === null) return NULL_COMPUTED;
        const upperBB = basis + kcMult * sd;
        const lowerBB = basis - kcMult * sd;

        // ── Keltner Channel ──────────────────────────────────────────────────
        const ma = sma(closesWindow, kcLength);
        const rangema = sma(trWindow, kcLength);
        if (ma === null || rangema === null) return NULL_COMPUTED;
        const upperKC = ma + rangema * kcMult;
        const lowerKC = ma - rangema * kcMult;

        // ── Squeeze State ────────────────────────────────────────────────────
        const sqzOn = lowerBB > lowerKC && upperBB < upperKC;
        const sqzOff = lowerBB < lowerKC && upperBB > upperKC;
        const noSqz = !sqzOn && !sqzOff;

        // ── Momentum via linreg on delta window ──────────────────────────────
        const deltaWindow = deltas.slice(i - kcLength + 1, i + 1);
        if (deltaWindow.some(v => v === null)) return NULL_COMPUTED;
        const validDeltas = deltaWindow.filter((v): v is number => v !== null);
        const momentum = linreg(validDeltas, kcLength);
        if (momentum === null) return NULL_COMPUTED;

        return { momentum, sqzOn, sqzOff, noSqz };
    });

    // Pass 2: add increasing field by comparing adjacent momentum values.
    return intermediate.map((r, i) => {
        if (r.momentum === null) return { ...r, increasing: null };
        const prevMomentum = i > 0 ? intermediate[i - 1].momentum : null;
        return {
            ...r,
            increasing:
                prevMomentum !== null ? r.momentum > prevMomentum : null,
        };
    });
}
