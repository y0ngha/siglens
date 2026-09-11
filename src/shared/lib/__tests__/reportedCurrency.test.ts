import { normalizeReportedCurrency } from '@/shared/lib/reportedCurrency';

describe('normalizeReportedCurrency', () => {
    it('trims surrounding whitespace', () => {
        expect(normalizeReportedCurrency(' TWD ')).toBe('TWD');
    });

    it('returns null for an empty string', () => {
        expect(normalizeReportedCurrency('')).toBeNull();
    });

    it('returns null for a whitespace-only string', () => {
        expect(normalizeReportedCurrency('   ')).toBeNull();
    });

    it('returns null for undefined', () => {
        expect(normalizeReportedCurrency(undefined)).toBeNull();
    });

    it('returns null for null', () => {
        expect(normalizeReportedCurrency(null)).toBeNull();
    });
});
