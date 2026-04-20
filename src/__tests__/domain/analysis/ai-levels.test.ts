import {
    SL_FALLBACK_ATR_MULTIPLIER,
    SL_MAX_ATR_MULTIPLIER,
    TP_FALLBACK_ATR_MULTIPLIER,
    TP_MAX_ATR_MULTIPLIER,
    deriveFallbackStopLoss,
    deriveFallbackTakeProfit,
    isValidBullishStopLoss,
    isValidBullishTakeProfit,
    resolveBullishStopLoss,
    resolveBullishTakeProfit,
} from '@/domain/analysis/ai-levels';

describe('isValidBullishStopLoss', () => {
    it.each<
        [
            label: string,
            sl: number | undefined,
            atr: number | undefined,
            expected: boolean,
        ]
    >([
        ['SL below entry, within ATR*5', 95, 5, true],
        ['SL equal to entry', 100, 5, false],
        ['SL above entry', 105, 5, false],
        [
            'SL far below entry (> ATR*5)',
            100 - 5 * SL_MAX_ATR_MULTIPLIER - 0.01,
            5,
            false,
        ],
        [
            'SL exactly at entry - ATR*5 boundary',
            100 - 5 * SL_MAX_ATR_MULTIPLIER,
            5,
            true,
        ],
        ['ATR undefined, SL below entry', 95, undefined, true],
        ['ATR = 0, SL below entry (ATR bound skipped)', 95, 0, true],
        ['ATR negative, SL below entry (ATR bound skipped)', 95, -1, true],
        ['ATR = NaN, SL below entry (ATR bound skipped)', 95, Number.NaN, true],
        ['SL = 0', 0, 5, false],
        ['SL negative', -10, 5, false],
        ['SL = NaN', Number.NaN, 5, false],
        ['SL = Infinity', Number.POSITIVE_INFINITY, 5, false],
        ['SL = -Infinity', Number.NEGATIVE_INFINITY, 5, false],
        ['SL = undefined', undefined, 5, false],
    ])('%s → %s', (_label, sl, atr, expected) => {
        expect(isValidBullishStopLoss(sl, 100, atr)).toBe(expected);
    });
});

describe('isValidBullishTakeProfit', () => {
    it.each<
        [
            label: string,
            tp: number | undefined,
            atr: number | undefined,
            expected: boolean,
        ]
    >([
        ['TP above entry, within ATR*10', 110, 5, true],
        ['TP equal to entry', 100, 5, false],
        ['TP below entry', 95, 5, false],
        [
            'TP far above entry (> ATR*10)',
            100 + 5 * TP_MAX_ATR_MULTIPLIER + 0.01,
            5,
            false,
        ],
        [
            'TP exactly at entry + ATR*10 boundary',
            100 + 5 * TP_MAX_ATR_MULTIPLIER,
            5,
            true,
        ],
        ['ATR undefined, TP above entry', 110, undefined, true],
        ['ATR = 0, TP above entry (ATR bound skipped)', 110, 0, true],
        ['TP = 0', 0, 5, false],
        ['TP negative', -5, 5, false],
        ['TP = NaN', Number.NaN, 5, false],
        ['TP = Infinity', Number.POSITIVE_INFINITY, 5, false],
        ['TP = undefined', undefined, 5, false],
    ])('%s → %s', (_label, tp, atr, expected) => {
        expect(isValidBullishTakeProfit(tp, 100, atr)).toBe(expected);
    });
});

describe('deriveFallbackStopLoss', () => {
    it('returns entryPrice - ATR * SL_FALLBACK_ATR_MULTIPLIER when ATR is positive', () => {
        const result = deriveFallbackStopLoss(100, 5);
        expect(result).toBeCloseTo(100 - 5 * SL_FALLBACK_ATR_MULTIPLIER, 6);
        expect(result).toBeCloseTo(92.5, 6);
    });

    it('returns undefined when ATR = 0', () => {
        expect(deriveFallbackStopLoss(100, 0)).toBeUndefined();
    });

    it('returns undefined when ATR is undefined', () => {
        expect(deriveFallbackStopLoss(100, undefined)).toBeUndefined();
    });

    it('returns undefined when ATR is negative', () => {
        expect(deriveFallbackStopLoss(100, -1)).toBeUndefined();
    });

    it('returns undefined when ATR is NaN', () => {
        expect(deriveFallbackStopLoss(100, Number.NaN)).toBeUndefined();
    });

    it('returns undefined when ATR is Infinity', () => {
        // Infinity * multiplier → Infinity; we treat it as unusable to match isFinite guard.
        expect(
            deriveFallbackStopLoss(100, Number.POSITIVE_INFINITY)
        ).toBeUndefined();
    });
});

describe('deriveFallbackTakeProfit', () => {
    it('returns entryPrice + ATR * TP_FALLBACK_ATR_MULTIPLIER when ATR is positive', () => {
        const result = deriveFallbackTakeProfit(100, 5);
        expect(result).toBeCloseTo(100 + 5 * TP_FALLBACK_ATR_MULTIPLIER, 6);
        expect(result).toBeCloseTo(110, 6);
    });

    it('returns undefined when ATR = 0', () => {
        expect(deriveFallbackTakeProfit(100, 0)).toBeUndefined();
    });

    it('returns undefined when ATR is undefined', () => {
        expect(deriveFallbackTakeProfit(100, undefined)).toBeUndefined();
    });

    it('returns undefined when ATR is negative', () => {
        expect(deriveFallbackTakeProfit(100, -0.001)).toBeUndefined();
    });
});

describe('resolveBullishStopLoss', () => {
    it('valid AI value → { value: aiValue, source: "ai" }', () => {
        const result = resolveBullishStopLoss(95, 100, 5);
        expect(result.source).toBe('ai');
        expect(result.value).toBe(95);
    });

    it('invalid AI value + ATR present → { value: fallback, source: "fallback" }', () => {
        const result = resolveBullishStopLoss(105, 100, 5); // SL above entry invalid
        expect(result.source).toBe('fallback');
        expect(result.value).toBeCloseTo(
            100 - 5 * SL_FALLBACK_ATR_MULTIPLIER,
            6
        );
    });

    it('invalid AI value + ATR absent → { value: undefined, source: "missing" }', () => {
        const result = resolveBullishStopLoss(105, 100, undefined);
        expect(result.source).toBe('missing');
        expect(result.value).toBeUndefined();
    });

    it('AI undefined + ATR present → { value: fallback, source: "fallback" }', () => {
        const result = resolveBullishStopLoss(undefined, 100, 5);
        expect(result.source).toBe('fallback');
        expect(result.value).toBeCloseTo(92.5, 6);
    });

    it('AI undefined + ATR absent → { value: undefined, source: "missing" }', () => {
        const result = resolveBullishStopLoss(undefined, 100, undefined);
        expect(result.source).toBe('missing');
        expect(result.value).toBeUndefined();
    });

    it('AI too far below entry + ATR present → fallback', () => {
        const farSl = 100 - 5 * SL_MAX_ATR_MULTIPLIER - 10;
        const result = resolveBullishStopLoss(farSl, 100, 5);
        expect(result.source).toBe('fallback');
        expect(result.value).toBeCloseTo(92.5, 6);
    });

    it('AI NaN + ATR = 0 → missing', () => {
        const result = resolveBullishStopLoss(Number.NaN, 100, 0);
        expect(result.source).toBe('missing');
        expect(result.value).toBeUndefined();
    });
});

describe('resolveBullishTakeProfit', () => {
    it('valid AI value → { value: aiValue, source: "ai" }', () => {
        const result = resolveBullishTakeProfit(110, 100, 5);
        expect(result.source).toBe('ai');
        expect(result.value).toBe(110);
    });

    it('invalid AI value + ATR present → { value: fallback, source: "fallback" }', () => {
        const result = resolveBullishTakeProfit(95, 100, 5); // TP below entry invalid
        expect(result.source).toBe('fallback');
        expect(result.value).toBeCloseTo(
            100 + 5 * TP_FALLBACK_ATR_MULTIPLIER,
            6
        );
    });

    it('invalid AI value + ATR absent → { value: undefined, source: "missing" }', () => {
        const result = resolveBullishTakeProfit(95, 100, undefined);
        expect(result.source).toBe('missing');
        expect(result.value).toBeUndefined();
    });

    it('AI undefined + ATR present → { value: fallback, source: "fallback" }', () => {
        const result = resolveBullishTakeProfit(undefined, 100, 5);
        expect(result.source).toBe('fallback');
        expect(result.value).toBeCloseTo(110, 6);
    });

    it('AI undefined + ATR absent → { value: undefined, source: "missing" }', () => {
        const result = resolveBullishTakeProfit(undefined, 100, undefined);
        expect(result.source).toBe('missing');
        expect(result.value).toBeUndefined();
    });

    it('AI too far above entry + ATR present → fallback', () => {
        const farTp = 100 + 5 * TP_MAX_ATR_MULTIPLIER + 50;
        const result = resolveBullishTakeProfit(farTp, 100, 5);
        expect(result.source).toBe('fallback');
        expect(result.value).toBeCloseTo(110, 6);
    });

    it('AI Infinity + ATR = 0 → missing', () => {
        const result = resolveBullishTakeProfit(
            Number.POSITIVE_INFINITY,
            100,
            0
        );
        expect(result.source).toBe('missing');
        expect(result.value).toBeUndefined();
    });
});
