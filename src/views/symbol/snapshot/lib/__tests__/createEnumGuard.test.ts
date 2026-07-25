import { describe, it, expect } from 'vitest';
import { createEnumGuard } from '../createEnumGuard';

const LABEL_MAP = {
    bullish: '강세',
    bearish: '약세',
    neutral: '중립',
} as const;

describe('createEnumGuard', () => {
    const isSentiment = createEnumGuard(LABEL_MAP);

    it('accepts every key declared in the label map', () => {
        expect(isSentiment('bullish')).toBe(true);
        expect(isSentiment('bearish')).toBe(true);
        expect(isSentiment('neutral')).toBe(true);
    });

    it('rejects a string not present in the label map', () => {
        expect(isSentiment('unknown-value')).toBe(false);
        expect(isSentiment('')).toBe(false);
    });

    it('rejects non-string input', () => {
        expect(isSentiment(null)).toBe(false);
        expect(isSentiment(undefined)).toBe(false);
        expect(isSentiment(42)).toBe(false);
        expect(isSentiment(true)).toBe(false);
        expect(isSentiment({})).toBe(false);
        expect(isSentiment(['bullish'])).toBe(false);
        expect(isSentiment({ toString: () => 'bullish' })).toBe(false);
    });

    // The `__proto__`/`constructor`/`toString` hostile cases — `in` would
    // walk the prototype chain and treat these as present (see the factory's
    // JSDoc rationale). `Object.hasOwn` must reject all three.
    it('rejects prototype-chain properties (__proto__/constructor/toString) — the production-500 guard', () => {
        expect(isSentiment('__proto__')).toBe(false);
        expect(isSentiment('constructor')).toBe(false);
        expect(isSentiment('toString')).toBe(false);
        expect(isSentiment('hasOwnProperty')).toBe(false);
    });

    it('does not throw and does not resolve to a function/object when given a hostile key', () => {
        expect(() => isSentiment('__proto__')).not.toThrow();
    });
});
