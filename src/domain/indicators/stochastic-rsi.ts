import type { StochRSIResult } from '@/domain/types';
import { calculateRSI } from '@/domain/indicators/rsi';
import {
    STOCH_RSI_RSI_PERIOD,
    STOCH_RSI_STOCH_PERIOD,
    STOCH_RSI_K_PERIOD,
    STOCH_RSI_D_PERIOD,
} from '@/domain/indicators/constants';
import { sma } from '@/domain/indicators/utils';

/**
 * Stochastic RSI = (RSI - min(RSI, stochPeriod)) / (max(RSI, stochPeriod) - min(RSI, stochPeriod))
 * %K = SMA(Stochastic RSI, kSmoothing)
 * %D = SMA(%K, dPeriod)
 *
 * Range: 0.0 - 1.0 (not multiplied by 100)
 * Default: RSI(14), Stoch(14), K(3), D(3)
 */
export function calculateStochRSI(
    closes: number[],
    rsiPeriod = STOCH_RSI_RSI_PERIOD,
    stochPeriod = STOCH_RSI_STOCH_PERIOD,
    kSmoothing = STOCH_RSI_K_PERIOD,
    dPeriod = STOCH_RSI_D_PERIOD
): StochRSIResult[] {
    if (closes.length === 0) return [];

    const rsiValues = calculateRSI(closes, rsiPeriod);

    // Build raw Stochastic RSI aligned to original indices
    // For each bar, compute (RSI - min(RSI over stochPeriod)) / (max - min)
    const rawStochRSI: (number | null)[] = rsiValues.map((rsi, i) => {
        if (rsi === null) return null;

        // Collect the last stochPeriod RSI values ending at i
        const windowStart = Math.max(0, i - stochPeriod + 1);
        const rsiWindow = rsiValues
            .slice(windowStart, i + 1)
            .filter((v): v is number => v !== null);

        if (rsiWindow.length < stochPeriod) return null;

        const maxRSI = Math.max(...rsiWindow);
        const minRSI = Math.min(...rsiWindow);
        const range = maxRSI - minRSI;

        if (range === 0) return 0;
        return (rsi - minRSI) / range;
    });

    // Build %K: SMA of rawStochRSI values, aligned to original indices
    // Collect accumulated valid rawStochRSI values for SMA calculation
    const kValues: (number | null)[] = rawStochRSI.map((raw, i) => {
        if (raw === null) return null;

        // Collect last kSmoothing valid rawStochRSI values ending at i
        const windowStart = Math.max(0, i - kSmoothing + 1);
        const validWindow = rawStochRSI
            .slice(windowStart, i + 1)
            .filter((v): v is number => v !== null);

        return sma(validWindow, kSmoothing);
    });

    // Build %D: SMA of %K values, aligned to original indices
    const dValues: (number | null)[] = kValues.map((k, i) => {
        if (k === null) return null;

        const windowStart = Math.max(0, i - dPeriod + 1);
        const validWindow = kValues
            .slice(windowStart, i + 1)
            .filter((v): v is number => v !== null);

        return sma(validWindow, dPeriod);
    });

    return closes.map(
        (_, i): StochRSIResult => ({
            k: kValues[i] ?? null,
            d: dValues[i] ?? null,
        })
    );
}
