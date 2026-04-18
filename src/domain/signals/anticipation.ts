import type { BollingerResult } from '@/domain/types';

export function findPivotLows(lows: number[], window: number): number[] {
    const pivots: number[] = [];
    for (let i = window; i < lows.length - window; i++) {
        const cur = lows[i];
        let isPivot = true;
        for (let k = 1; k <= window; k++) {
            if (!(cur < lows[i - k]) || !(cur < lows[i + k])) {
                isPivot = false;
                break;
            }
        }
        if (isPivot) pivots.push(i);
    }
    return pivots;
}

export function findPivotHighs(highs: number[], window: number): number[] {
    const pivots: number[] = [];
    for (let i = window; i < highs.length - window; i++) {
        const cur = highs[i];
        let isPivot = true;
        for (let k = 1; k <= window; k++) {
            if (!(cur > highs[i - k]) || !(cur > highs[i + k])) {
                isPivot = false;
                break;
            }
        }
        if (isPivot) pivots.push(i);
    }
    return pivots;
}

export function computeBbWidth(bb: BollingerResult): number | null {
    if (bb.upper === null || bb.middle === null || bb.lower === null) return null;
    if (bb.middle === 0) return null;
    return (bb.upper - bb.lower) / bb.middle;
}

export function computePctB(close: number, bb: BollingerResult): number | null {
    if (bb.upper === null || bb.lower === null) return null;
    const denom = bb.upper - bb.lower;
    if (denom === 0) return null;
    return (close - bb.lower) / denom;
}

export function computeEma20Slope(
    ema: (number | null)[],
    lookback: number
): number | null {
    if (ema.length < lookback + 1) return null;
    const last = ema[ema.length - 1];
    const prev = ema[ema.length - 1 - lookback];
    if (last === null || prev === null || prev === 0) return null;
    return (last - prev) / prev;
}

export function percentileRank(value: number, xs: number[]): number | null {
    if (xs.length === 0) return null;
    if (xs.length === 1) {
        if (value === xs[0]) return 0.5;
        return value > xs[0] ? 1 : 0;
    }
    const below = xs.filter((x) => x < value).length;
    const equal = xs.filter((x) => x === value).length;
    if (equal === 0) {
        return below / xs.length;
    }
    return below / (xs.length - 1);
}
