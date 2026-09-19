import { describe, expect, it } from 'vitest';
import { pctVs, ppDelta, ratioPct } from '@/app/api/ai/chat/tools/percent';

describe('pctVs', () => {
    it('normal: (current-base)/base*100', () => {
        expect(pctVs(110, 100)).toBe(10);
        expect(pctVs(90, 100)).toBe(-10);
    });
    it('zero base → null', () => {
        expect(pctVs(10, 0)).toBeNull();
    });
    it('negative base → null', () => {
        expect(pctVs(10, -5)).toBeNull();
    });
    it('NaN input → null', () => {
        expect(pctVs(Number.NaN, 100)).toBeNull();
        expect(pctVs(100, Number.NaN)).toBeNull();
    });
    it('null/undefined input → null', () => {
        expect(pctVs(null, 100)).toBeNull();
        expect(pctVs(100, null)).toBeNull();
        expect(pctVs(undefined, 100)).toBeNull();
    });
});

describe('ppDelta', () => {
    it('normal: a-b', () => {
        expect(ppDelta(12.5, 10)).toBe(2.5);
    });
    it('zero: a-0', () => {
        expect(ppDelta(5, 0)).toBe(5);
    });
    it('negative: a-(-b)', () => {
        expect(ppDelta(5, -5)).toBe(10);
    });
    it('NaN input → null', () => {
        expect(ppDelta(Number.NaN, 1)).toBeNull();
    });
    it('null input → null', () => {
        expect(ppDelta(null, 1)).toBeNull();
    });
});

describe('ratioPct', () => {
    it('normal: numerator/denominator*100', () => {
        expect(ratioPct(3, 150)).toBe(2);
    });
    it('zero denominator → null', () => {
        expect(ratioPct(3, 0)).toBeNull();
    });
    it('negative denominator → null', () => {
        expect(ratioPct(3, -150)).toBeNull();
    });
    it('NaN input → null', () => {
        expect(ratioPct(Number.NaN, 150)).toBeNull();
    });
    it('null input → null', () => {
        expect(ratioPct(null, 150)).toBeNull();
    });
});
