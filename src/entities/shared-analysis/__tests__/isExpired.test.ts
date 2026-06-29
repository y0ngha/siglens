import { isExpired } from '@/entities/shared-analysis/lib/isExpired';

describe('isExpired', () => {
    const now = new Date('2026-06-29T00:00:00Z');
    it('returns false when expiresAt is in the future', () => {
        expect(isExpired(new Date('2026-06-30T00:00:00Z'), now)).toBe(false);
    });
    it('returns true when expiresAt is in the past', () => {
        expect(isExpired(new Date('2026-06-28T00:00:00Z'), now)).toBe(true);
    });
    it('returns true at the exact boundary', () => {
        expect(isExpired(new Date('2026-06-29T00:00:00Z'), now)).toBe(true);
    });
});
