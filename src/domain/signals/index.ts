import type { Bar, IndicatorResult, Signal } from '@/domain/types';
import {
    detectBollingerLowerBounce,
    detectBollingerUpperBreakout,
    detectCciBullishCross,
    detectCmfBullishFlip,
    detectDeathCross,
    detectDmiBullishCross,
    detectGoldenCross,
    detectIchimokuCloudBreakout,
    detectKeltnerUpperBreakout,
    detectMacdBearishCross,
    detectMacdBullishCross,
    detectMfiOversoldBounce,
    detectParabolicSarFlip,
    detectRsiOverbought,
    detectRsiOversold,
    detectSqueezeMomentumBullish,
    detectSupertrendBullishFlip,
} from '@/domain/signals/confirmed';
import {
    detectBollingerSqueezeBearish,
    detectBollingerSqueezeBullish,
    detectMacdHistogramBearishConvergence,
    detectMacdHistogramBullishConvergence,
    detectResistanceProximityBearish,
    detectRsiBearishDivergence,
    detectRsiBullishDivergence,
    detectSupportProximityBullish,
} from '@/domain/signals/anticipation';

export { classifyTrend } from '@/domain/signals/trend';

type Detector = (bars: Bar[], indicators: IndicatorResult) => Signal | null;

const DETECTORS: readonly Detector[] = [
    // Confirmed bullish/bearish (pre-existing)
    detectRsiOversold,
    detectRsiOverbought,
    detectGoldenCross,
    detectDeathCross,
    detectMacdBullishCross,
    detectMacdBearishCross,
    detectBollingerLowerBounce,
    detectBollingerUpperBreakout,
    // Confirmed bullish (Tasks 4-12, buy-only backtest)
    detectSupertrendBullishFlip,
    detectIchimokuCloudBreakout,
    detectCciBullishCross,
    detectDmiBullishCross,
    detectCmfBullishFlip,
    detectMfiOversoldBounce,
    detectParabolicSarFlip,
    detectKeltnerUpperBreakout,
    detectSqueezeMomentumBullish,
    // Anticipation (pre-existing)
    detectRsiBullishDivergence,
    detectRsiBearishDivergence,
    detectMacdHistogramBullishConvergence,
    detectMacdHistogramBearishConvergence,
    detectBollingerSqueezeBullish,
    detectBollingerSqueezeBearish,
    detectSupportProximityBullish,
    detectResistanceProximityBearish,
];

export function detectSignals(
    bars: Bar[],
    indicators: IndicatorResult
): readonly Signal[] {
    if (bars.length === 0) return [];
    return DETECTORS.map(d => d(bars, indicators)).filter(
        (s): s is Signal => s !== null
    );
}
