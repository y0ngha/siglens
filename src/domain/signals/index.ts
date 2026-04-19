import type { Bar, IndicatorResult } from '@/domain/types';
import type { Signal } from '@/domain/signals/types';
import {
    detectBollingerLowerBounce,
    detectBollingerUpperBreakout,
    detectDeathCross,
    detectGoldenCross,
    detectMacdBearishCross,
    detectMacdBullishCross,
    detectRsiOverbought,
    detectRsiOversold,
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

export * from '@/domain/signals/types';
export { classifyTrend } from '@/domain/signals/trend';

type Detector = (bars: Bar[], indicators: IndicatorResult) => Signal | null;

const DETECTORS: readonly Detector[] = [
    detectRsiOversold,
    detectRsiOverbought,
    detectGoldenCross,
    detectDeathCross,
    detectMacdBullishCross,
    detectMacdBearishCross,
    detectBollingerLowerBounce,
    detectBollingerUpperBreakout,
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
    return DETECTORS.map((d) => d(bars, indicators)).filter(
        (s): s is Signal => s !== null
    );
}
