/**
 * Unit tests for resolvePriceDecimals.
 *
 * Mirrors priceFormat.test.ts style — pure function, no mocks needed.
 * Verifies:
 *   - crypto + sub-cent lastClose → expanded precision via dynamicDecimals
 *   - crypto + large lastClose (BTC) → 2dp (dynamicDecimals: value >= 1)
 *   - us-equity → fixed 2dp regardless of lastClose
 *   - lastClose undefined → defaults to 1 (dynamicDecimals(1) = 2)
 */

import { describe, it, expect } from 'vitest';
import { resolvePriceDecimals } from '@/shared/lib/priceFormat';

describe('resolvePriceDecimals', () => {
    describe('crypto (dynamic-by-magnitude precision)', () => {
        it('sub-cent lastClose with 3 leading zeros → 7dp', () => {
            // 0.0008 → Math.floor(-Math.log10(0.0008)) = Math.floor(3.096) = 3 → 3 + 4 = 7
            expect(resolvePriceDecimals('crypto', 0.0008)).toBe(7);
        });

        it('sub-cent lastClose → matches dynamicDecimals output exactly', () => {
            // 0.058158 → 5dp per priceFormat.test.ts reference
            expect(resolvePriceDecimals('crypto', 0.058158)).toBe(5);
        });

        it('large crypto lastClose (BTC ~64192) → 2dp', () => {
            // dynamicDecimals clamps value >= 1 to 2dp
            expect(resolvePriceDecimals('crypto', 64192)).toBe(2);
        });

        it('sub-dollar lastClose (0.005) → 6dp (2 leading zeros + 4)', () => {
            // Math.floor(-Math.log10(0.005)) = 2 → 2 + 4 = 6
            expect(resolvePriceDecimals('crypto', 0.005)).toBe(6);
        });

        it('lastClose undefined → defaults to 1 → 2dp', () => {
            // Fallback: dynamicDecimals(1) = 2 (value >= 1)
            expect(resolvePriceDecimals('crypto', undefined)).toBe(2);
        });
    });

    describe('us-equity (fixed 2dp precision)', () => {
        it('returns 2 regardless of lastClose', () => {
            expect(resolvePriceDecimals('us-equity', 123.45)).toBe(2);
        });

        it('returns 2 even for sub-cent lastClose (fixed always wins)', () => {
            // Equity never uses dynamicDecimals — precision.kind is 'fixed'
            expect(resolvePriceDecimals('us-equity', 0.001)).toBe(2);
        });

        it('returns 2 when lastClose is undefined', () => {
            expect(resolvePriceDecimals('us-equity', undefined)).toBe(2);
        });
    });
});
