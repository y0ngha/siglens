import { toYahooSymbol } from '@/shared/lib/yahooSymbol';

describe('toYahooSymbol', () => {
    it('maps verified US class-share aliases to Yahoo notation', () => {
        expect(toYahooSymbol('BRK.B')).toBe('BRK-B');
    });

    it('preserves exchange suffix dots and ordinary symbols', () => {
        expect(toYahooSymbol('VOD.L')).toBe('VOD.L');
        expect(toYahooSymbol('7203.T')).toBe('7203.T');
        expect(toYahooSymbol('AAPL')).toBe('AAPL');
    });
});
