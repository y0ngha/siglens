import { symbolLabel } from '@/shared/lib/symbolLabel';

describe('symbolLabel', () => {
    it('formats as "name (symbol)" when a name is known', () => {
        expect(symbolLabel('AAPL', 'Apple Inc.')).toBe('Apple Inc. (AAPL)');
    });

    it('falls back to the bare symbol when the name is missing or equals the symbol', () => {
        expect(symbolLabel('AAPL', null)).toBe('AAPL');
        expect(symbolLabel('AAPL', undefined)).toBe('AAPL');
        expect(symbolLabel('AAPL', '')).toBe('AAPL');
        expect(symbolLabel('AAPL', 'AAPL')).toBe('AAPL');
    });
});
