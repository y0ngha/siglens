import { describe, it, expect } from 'vitest';
import { isUnresolvableDegraded } from '../symbolGuard';

describe('isUnresolvableDegraded', () => {
    describe('true branch — degraded + non-US ticker shape', () => {
        it('returns true for a digit-first crypto symbol when degraded', () => {
            // 1INCHUSD starts with a digit → fails VALID_TICKER_RE (^[A-Z]…)
            expect(isUnresolvableDegraded('1INCHUSD', true)).toBe(true);
        });

        it('returns true for other digit-first symbols when degraded', () => {
            expect(isUnresolvableDegraded('3COMSUSD', true)).toBe(true);
        });
    });

    describe('false branch — US ticker shape (preserve degrade-200 behaviour)', () => {
        it('returns false for a valid US ticker even when degraded', () => {
            // AAPL passes VALID_TICKER_RE — transient FMP outage should NOT 404
            expect(isUnresolvableDegraded('AAPL', true)).toBe(false);
        });

        it('returns false for any symbol when NOT degraded', () => {
            // Non-degraded path: normal resolution, guard must not fire
            expect(isUnresolvableDegraded('1INCHUSD', false)).toBe(false);
            expect(isUnresolvableDegraded('AAPL', false)).toBe(false);
        });
    });

    describe('kr-equity early return (isKrEquitySymbol) — preserve degrade-200 behaviour', () => {
        it('returns false for a KR-equity symbol even when degraded (no hard 404 during a yahoo outage)', () => {
            expect(isUnresolvableDegraded('005930.KS', true)).toBe(false);
        });

        it('does not widen the crypto branch — digit-first crypto symbols still 404 when degraded', () => {
            // Pins that the KR early return is scoped to KR_SYMBOL_RE and does not
            // accidentally swallow the crypto class the original guard was written for.
            expect(isUnresolvableDegraded('1INCHUSD', true)).toBe(true);
        });
    });
});
