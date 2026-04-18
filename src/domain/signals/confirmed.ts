import type { Bar, IndicatorResult } from '@/domain/types';
import type { Signal } from '@/domain/signals/types';
import {
    RSI_OVERBOUGHT_LEVEL,
    RSI_OVERSOLD_LEVEL,
} from '@/domain/indicators/constants';

export function detectRsiOversold(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const rsi = indicators.rsi;
    if (rsi.length === 0) return null;
    const lastIdx = rsi.length - 1;
    const last = rsi[lastIdx];
    if (last === null) return null;
    if (last >= RSI_OVERSOLD_LEVEL) return null;
    return {
        type: 'rsi_oversold',
        direction: 'bullish',
        phase: 'confirmed',
        detectedAt: lastIdx,
    };
}

export function detectRsiOverbought(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const rsi = indicators.rsi;
    if (rsi.length === 0) return null;
    const lastIdx = rsi.length - 1;
    const last = rsi[lastIdx];
    if (last === null) return null;
    if (last <= RSI_OVERBOUGHT_LEVEL) return null;
    return {
        type: 'rsi_overbought',
        direction: 'bearish',
        phase: 'confirmed',
        detectedAt: lastIdx,
    };
}
