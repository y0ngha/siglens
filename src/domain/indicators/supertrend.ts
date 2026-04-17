import type { Bar, SupertrendResult, PriceTrend } from '@/domain/types';
import {
    SUPERTREND_ATR_PERIOD,
    SUPERTREND_MULTIPLIER,
} from '@/domain/indicators/constants';
import { calculateATR } from '@/domain/indicators/atr';

interface SupertrendState {
    finalUpperBand: number;
    finalLowerBand: number;
    trend: PriceTrend;
}

const NULL_RESULT: SupertrendResult = { supertrend: null, trend: null };

export function calculateSupertrend(
    bars: Bar[],
    atrPeriod = SUPERTREND_ATR_PERIOD,
    multiplier = SUPERTREND_MULTIPLIER
): SupertrendResult[] {
    if (bars.length === 0) return [];

    const atrValues = calculateATR(bars, atrPeriod);

    if (bars.length <= atrPeriod) return bars.map(() => NULL_RESULT);

    const firstValidIdx = atrPeriod;
    const firstATR = atrValues[firstValidIdx]!;
    const firstBar = bars[firstValidIdx];
    const hl2 = (firstBar.high + firstBar.low) / 2;

    const initialState: SupertrendState = {
        finalUpperBand: hl2 + multiplier * firstATR,
        finalLowerBand: hl2 - multiplier * firstATR,
        trend: firstBar.close > hl2 ? 'up' : 'down',
    };

    const firstResult: SupertrendResult = {
        supertrend:
            initialState.trend === 'up'
                ? initialState.finalLowerBand
                : initialState.finalUpperBand,
        trend: initialState.trend,
    };

    const results: SupertrendResult[] = new Array(bars.length);
    results.fill(NULL_RESULT, 0, firstValidIdx);
    results[firstValidIdx] = firstResult;
    let stState = initialState;
    for (let i = firstValidIdx + 1; i < bars.length; i++) {
        const bar = bars[i];
        const atr = atrValues[i]!;
        const currentHL2 = (bar.high + bar.low) / 2;
        const basicUpperBand = currentHL2 + multiplier * atr;
        const basicLowerBand = currentHL2 - multiplier * atr;
        const prevClose = bars[i - 1].close;

        const finalUpperBand =
            basicUpperBand < stState.finalUpperBand ||
            prevClose > stState.finalUpperBand
                ? basicUpperBand
                : stState.finalUpperBand;

        const finalLowerBand =
            basicLowerBand > stState.finalLowerBand ||
            prevClose < stState.finalLowerBand
                ? basicLowerBand
                : stState.finalLowerBand;

        const trend: PriceTrend =
            stState.trend === 'up'
                ? bar.close < finalLowerBand
                    ? 'down'
                    : 'up'
                : bar.close > finalUpperBand
                  ? 'up'
                  : 'down';

        results[i] = {
            supertrend: trend === 'up' ? finalLowerBand : finalUpperBand,
            trend,
        };
        stState = { finalUpperBand, finalLowerBand, trend };
    }

    return results;
}
