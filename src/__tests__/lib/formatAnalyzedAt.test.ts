import { formatAnalyzedAt } from '@/lib/formatAnalyzedAt';

describe('formatAnalyzedAt', () => {
    it('formats ISO timestamp into a human-readable Korean string', () => {
        const result = formatAnalyzedAt('2026-05-22T05:30:00.000Z');
        expect(result).toMatch(/2026/);
        expect(result).toMatch(/05|5월/);
    });

    it('returns a fallback when the input is not a valid ISO string', () => {
        const result = formatAnalyzedAt('not-a-date');
        expect(typeof result).toBe('string');
    });
});
