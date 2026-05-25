import { formatCompactCount } from '@/widgets/options/utils/formatCompactCount';

describe('formatCompactCount', () => {
    it('formats millions with one decimal', () => {
        expect(formatCompactCount(1_500_000)).toBe('1.5M');
    });

    it('formats exact million', () => {
        expect(formatCompactCount(1_000_000)).toBe('1.0M');
    });

    it('formats thousands with one decimal', () => {
        expect(formatCompactCount(4_500)).toBe('4.5k');
    });

    it('formats exact thousand', () => {
        expect(formatCompactCount(1_000)).toBe('1.0k');
    });

    it('returns raw number string for values below 1000', () => {
        expect(formatCompactCount(750)).toBe('750');
    });

    it('returns zero as string', () => {
        expect(formatCompactCount(0)).toBe('0');
    });

    it('formats large millions', () => {
        expect(formatCompactCount(12_300_000)).toBe('12.3M');
    });

    it('formats values just at million boundary', () => {
        expect(formatCompactCount(999_999)).toBe('1000.0k');
    });
});
