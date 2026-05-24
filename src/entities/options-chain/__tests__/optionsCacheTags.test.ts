import { optionsSymbolTag } from '../lib/optionsCacheTags';

describe('optionsSymbolTag', () => {
    it('returns a stable `options:{symbol}` tag for uppercase tickers', () => {
        expect(optionsSymbolTag('AAPL')).toBe('options:AAPL');
    });

    it('preserves casing for lowercase input (caller is responsible for normalization)', () => {
        expect(optionsSymbolTag('aapl')).toBe('options:aapl');
    });

    it('handles symbols containing dots (e.g. preferred shares like BRK.B)', () => {
        expect(optionsSymbolTag('BRK.B')).toBe('options:BRK.B');
    });

    it('handles an empty string without throwing', () => {
        expect(optionsSymbolTag('')).toBe('options:');
    });

    it('returns distinct tags for distinct symbols', () => {
        expect(optionsSymbolTag('AAPL')).not.toBe(optionsSymbolTag('MSFT'));
    });
});
