import type { Bar, SupertrendResult } from '@/domain/types';
import {
    SUPERTREND_ATR_PERIOD,
    SUPERTREND_MULTIPLIER,
} from '@/domain/indicators/constants';
import { calculateATR } from '@/domain/indicators/atr';

interface SupertrendState {
    finalUpperBand: number;
    finalLowerBand: number;
    trend: 'up' | 'down';
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

    const { results } = bars.slice(firstValidIdx + 1).reduce<{
        state: SupertrendState;
        results: SupertrendResult[];
    }>(
        (acc, bar, i) => {
            const idx = firstValidIdx + 1 + i;
            const atr = atrValues[idx]!;
            const currentHL2 = (bar.high + bar.low) / 2;
            const basicUpperBand = currentHL2 + multiplier * atr;
            const basicLowerBand = currentHL2 - multiplier * atr;
            const prevClose = bars[idx - 1].close;

            const finalUpperBand =
                basicUpperBand < acc.state.finalUpperBand ||
                prevClose > acc.state.finalUpperBand
                    ? basicUpperBand
                    : acc.state.finalUpperBand;

            const finalLowerBand =
                basicLowerBand > acc.state.finalLowerBand ||
                prevClose < acc.state.finalLowerBand
                    ? basicLowerBand
                    : acc.state.finalLowerBand;

            const trend: 'up' | 'down' =
                acc.state.trend === 'up'
                    ? bar.close < finalLowerBand
                        ? 'down'
                        : 'up'
                    : bar.close > finalUpperBand
                      ? 'up'
                      : 'down';

            const supertrend = trend === 'up' ? finalLowerBand : finalUpperBand;

            return {
                state: { finalUpperBand, finalLowerBand, trend },
                results: [...acc.results, { supertrend, trend }],
            };
        },
        {
            state: initialState,
            results: [
                ...new Array(firstValidIdx).fill(NULL_RESULT),
                firstResult,
            ],
        }
    );

    return results;
}
