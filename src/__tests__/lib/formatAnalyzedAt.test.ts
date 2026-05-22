import { formatAnalyzedAt } from '@/lib/formatAnalyzedAt';

describe('formatAnalyzedAt', () => {
    it('replaces the "T" separator with a space and truncates to minute precision', () => {
        expect(formatAnalyzedAt('2026-05-22T05:30:00.000Z')).toBe('2026-05-22 05:30');
    });

    it('passes input through unchanged when shorter than 16 characters', () => {
        expect(formatAnalyzedAt('not-a-date')).toBe('not-a-date');
    });
});
