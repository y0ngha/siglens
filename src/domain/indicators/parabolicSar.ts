import type { Bar, ParabolicSARResult } from '@/domain/types';
import {
    PSAR_AF_START,
    PSAR_AF_INCREMENT,
    PSAR_AF_MAX,
} from '@/domain/indicators/constants';

interface PSARState {
    sar: number;
    ep: number;
    af: number;
    trend: 'up' | 'down';
}

const NULL_RESULT: ParabolicSARResult = { sar: null, trend: null };

function clampSARUptrend(sar: number, prevBar: Bar, prevPrevBar: Bar): number {
    return Math.min(sar, prevBar.low, prevPrevBar.low);
}

function clampSARDowntrend(
    sar: number,
    prevBar: Bar,
    prevPrevBar: Bar
): number {
    return Math.max(sar, prevBar.high, prevPrevBar.high);
}

function nextState(
    bar: Bar,
    prev: PSARState,
    afIncrement: number,
    afMax: number
): {
    state: PSARState;
    result: ParabolicSARResult;
} {
    const rawSAR = prev.sar + prev.af * (prev.ep - prev.sar);

    if (prev.trend === 'up') {
        if (bar.low < rawSAR) {
            // 하락 반전
            const newEP = bar.low;
            return {
                state: {
                    sar: prev.ep,
                    ep: newEP,
                    af: afIncrement,
                    trend: 'down',
                },
                result: { sar: prev.ep, trend: 'down' },
            };
        }
        const newEP = Math.max(prev.ep, bar.high);
        const newAF =
            newEP > prev.ep ? Math.min(prev.af + afIncrement, afMax) : prev.af;
        return {
            state: { sar: rawSAR, ep: newEP, af: newAF, trend: 'up' },
            result: { sar: rawSAR, trend: 'up' },
        };
    }

    // prev.trend === 'down'
    if (bar.high > rawSAR) {
        // 상승 반전
        const newEP = bar.high;
        return {
            state: { sar: prev.ep, ep: newEP, af: afIncrement, trend: 'up' },
            result: { sar: prev.ep, trend: 'up' },
        };
    }
    const newEP = Math.min(prev.ep, bar.low);
    const newAF =
        newEP < prev.ep ? Math.min(prev.af + afIncrement, afMax) : prev.af;
    return {
        state: { sar: rawSAR, ep: newEP, af: newAF, trend: 'down' },
        result: { sar: rawSAR, trend: 'down' },
    };
}

export function calculateParabolicSAR(
    bars: Bar[],
    afStart = PSAR_AF_START,
    afIncrement = PSAR_AF_INCREMENT,
    afMax = PSAR_AF_MAX
): ParabolicSARResult[] {
    if (bars.length === 0) return [];
    if (bars.length === 1) return [NULL_RESULT];

    const initialTrend: 'up' | 'down' =
        bars[1].close >= bars[0].close ? 'up' : 'down';

    const initialState: PSARState =
        initialTrend === 'up'
            ? { sar: bars[0].low, ep: bars[1].high, af: afStart, trend: 'up' }
            : {
                  sar: bars[0].high,
                  ep: bars[1].low,
                  af: afStart,
                  trend: 'down',
              };

    const initialResult: ParabolicSARResult = {
        sar: initialState.sar,
        trend: initialTrend,
    };

    const { results } = bars.slice(2).reduce<{
        state: PSARState;
        results: ParabolicSARResult[];
        prevBars: [Bar, Bar];
    }>(
        (acc, bar) => {
            // SAR 클램핑
            const clampedSAR =
                acc.state.trend === 'up'
                    ? clampSARUptrend(
                          acc.state.sar,
                          acc.prevBars[1],
                          acc.prevBars[0]
                      )
                    : clampSARDowntrend(
                          acc.state.sar,
                          acc.prevBars[1],
                          acc.prevBars[0]
                      );

            const clampedState = { ...acc.state, sar: clampedSAR };
            const { state, result } = nextState(
                bar,
                clampedState,
                afIncrement,
                afMax
            );

            return {
                state,
                results: [...acc.results, result],
                prevBars: [acc.prevBars[1], bar],
            };
        },
        {
            state: initialState,
            results: [NULL_RESULT, initialResult],
            prevBars: [bars[0], bars[1]],
        }
    );

    return results;
}
