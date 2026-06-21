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
});
