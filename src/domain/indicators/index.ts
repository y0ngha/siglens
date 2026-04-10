import type { Bar, IndicatorResult } from '@/domain/types';
import { calculateRSI } from './rsi';
import { calculateMACD } from './macd';
import { calculateBollinger } from './bollinger';
import { calculateDMI } from './dmi';
import { calculateVWAP } from './vwap';
import { calculateEMA } from './ema';
import { calculateMA } from './ma';
import { calculateStochastic } from './stochastic';
import { calculateStochRSI } from './stochastic-rsi';
import { calculateCCI } from './cci';
import { calculateVolumeProfile } from './volume-profile';
import { calculateIchimoku } from './ichimoku';
import { calculateATR } from './atr';
import { calculateOBV } from './obv';
import { calculateParabolicSAR } from './parabolicSar';
import { calculateWilliamsR } from './williamsR';
import { calculateSupertrend } from './supertrend';
import { calculateMFI } from './mfi';
import { calculateKeltnerChannel } from './keltnerChannel';
import { calculateCMF } from './cmf';
import { calculateDonchianChannel } from './donchianChannel';
import { MA_DEFAULT_PERIODS, EMA_DEFAULT_PERIODS } from './constants';

export * from './rsi';
export * from './macd';
export * from './bollinger';
export * from './dmi';
export * from './vwap';
export * from './ema';
export * from './ma';
export * from './stochastic';
export * from './stochastic-rsi';
export * from './cci';
export * from './volume-profile';
export * from './ichimoku';
export * from './atr';
export * from './obv';
export * from './parabolicSar';
export * from './williamsR';
export * from './supertrend';
export * from './mfi';
export * from './keltnerChannel';
export * from './cmf';
export * from './donchianChannel';

export function calculateIndicators(bars: Bar[]): IndicatorResult {
    const closes = bars.map(b => b.close);
    return {
        rsi: calculateRSI(closes),
        macd: calculateMACD(bars),
        bollinger: calculateBollinger(bars),
        dmi: calculateDMI(bars),
        stochastic: calculateStochastic(bars),
        stochRsi: calculateStochRSI(closes),
        cci: calculateCCI(bars),
        vwap: calculateVWAP(bars),
        ma: Object.fromEntries(
            MA_DEFAULT_PERIODS.map(period => [
                period,
                calculateMA(bars, period),
            ])
        ) as Record<number, (number | null)[]>,
        ema: Object.fromEntries(
            EMA_DEFAULT_PERIODS.map(period => [
                period,
                calculateEMA(bars, period),
            ])
        ) as Record<number, (number | null)[]>,
        volumeProfile: calculateVolumeProfile(bars),
        ichimoku: calculateIchimoku(bars),
        atr: calculateATR(bars),
        obv: calculateOBV(bars),
        parabolicSar: calculateParabolicSAR(bars),
        williamsR: calculateWilliamsR(bars),
        supertrend: calculateSupertrend(bars),
        mfi: calculateMFI(bars),
        keltnerChannel: calculateKeltnerChannel(bars),
        cmf: calculateCMF(bars),
        donchianChannel: calculateDonchianChannel(bars),
    };
}
