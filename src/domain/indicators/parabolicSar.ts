import type { Bar, ParabolicSARResult, PriceTrend } from '@/domain/types';
import {
    PSAR_AF_START,
    PSAR_AF_INCREMENT,
    PSAR_AF_MAX,
} from '@/domain/indicators/constants';

interface PSARState {
    sar: number;
    ep: number;
    af: number;
    trend: PriceTrend;
}

const NULL_RESULT: ParabolicSARResult = { sar: null, trend: null };

interface PSARNextStateResult {
    state: PSARState;
    result: ParabolicSARResult;
}

function nextState(
    bar: Bar,
    prev: PSARState,
    prevBars: [Bar, Bar],
    afIncrement: number,
    afMax: number
): PSARNextStateResult {
    const projectedSAR = prev.sar + prev.af * (prev.ep - prev.sar);

    // Wilder clamp: 현재 봉에 대해 새로 투영한 SAR 은 이전 두 봉의 저점(상승장)
    // 또는 고점(하락장)을 침범해서는 안 된다. clamp 는 이전 SAR 에 소급 적용하지
    // 않고, 방금 계산한 projectedSAR 에 대해서만 적용한다.
    const rawSAR =
        prev.trend === 'up'
            ? Math.min(projectedSAR, prevBars[0].low, prevBars[1].low)
            : Math.max(projectedSAR, prevBars[0].high, prevBars[1].high);

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

    const initialTrend: PriceTrend =
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

    const results: ParabolicSARResult[] = new Array(bars.length);
    results[0] = NULL_RESULT;
    results[1] = initialResult;
    let psarState = initialState;
    let prevBars: [Bar, Bar] = [bars[0], bars[1]];
    for (let i = 2; i < bars.length; i++) {
        const { state, result } = nextState(
            bars[i],
            psarState,
            prevBars,
            afIncrement,
            afMax
        );
        results[i] = result;
        psarState = state;
        prevBars = [prevBars[1], bars[i]];
    }

    return results;
}
