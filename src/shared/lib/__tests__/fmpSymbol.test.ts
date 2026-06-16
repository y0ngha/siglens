import { toFmpSymbol } from '@/shared/lib/fmpSymbol';

describe('toFmpSymbol', () => {
    it('maps verified US dual-class aliases to FMP notation', () => {
        expect(toFmpSymbol('BRK.B')).toBe('BRK-B');
        expect(toFmpSymbol('BRK.A')).toBe('BRK-A');
        expect(toFmpSymbol('BF.B')).toBe('BF-B');
        expect(toFmpSymbol('BF.A')).toBe('BF-A');
    });

    it('preserves exchange-suffix dots, index, and ordinary symbols', () => {
        expect(toFmpSymbol('VOD.L')).toBe('VOD.L');
        expect(toFmpSymbol('7203.T')).toBe('7203.T');
        expect(toFmpSymbol('^SPX')).toBe('^SPX');
        expect(toFmpSymbol('AAPL')).toBe('AAPL');
    });
});
