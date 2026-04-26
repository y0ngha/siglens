import type { Bar, KeltnerChannelResult } from '@/domain/types';
import {
    KELTNER_ATR_PERIOD,
    KELTNER_EMA_PERIOD,
    KELTNER_MULTIPLIER,
} from '@y0ngha/siglens-core';
import { computeEMAValues } from '@/domain/indicators/ema';
import { calculateATR } from '@/domain/indicators/atr';

const NULL_RESULT: KeltnerChannelResult = {
    upper: null,
    middle: null,
    lower: null,
};

export function calculateKeltnerChannel(
    bars: Bar[],
    emaPeriod = KELTNER_EMA_PERIOD,
    atrPeriod = KELTNER_ATR_PERIOD,
    multiplier = KELTNER_MULTIPLIER
): KeltnerChannelResult[] {
    if (bars.length === 0) return [];

    const closes = bars.map(b => b.close);
    const emaValues = computeEMAValues(closes, emaPeriod);
    const atrValues = calculateATR(bars, atrPeriod);

    return bars.map((_, i) => {
        const ema = emaValues[i];
        const atr = atrValues[i];
        if (ema === null || atr === null) return NULL_RESULT;
        return {
            upper: ema + multiplier * atr,
            middle: ema,
            lower: ema - multiplier * atr,
        };
    });
}
