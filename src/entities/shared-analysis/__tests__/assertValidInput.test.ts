import { isValidShareInput } from '@/entities/shared-analysis/server/assertValidInput';

describe('isValidShareInput', () => {
    it('accepts a well-formed chart input', () => {
        expect(
            isValidShareInput({
                kind: 'chart',
                symbol: 'AAPL',
                context: {
                    symbol: 'AAPL',
                    displayName: 'Apple',
                    assetClass: 'us_equity',
                },
                result: { trend: 'bullish', summary: 'x' },
                sharerTier: 'free',
            })
        ).toBe(true);
    });
    it('rejects unknown kind', () => {
        expect(
            isValidShareInput({
                kind: 'bogus',
                symbol: 'AAPL',
                context: {},
                result: {},
                sharerTier: 'free',
            })
        ).toBe(false);
    });
    it('rejects missing symbol', () => {
        expect(
            isValidShareInput({
                kind: 'chart',
                context: {},
                result: {},
                sharerTier: 'free',
            })
        ).toBe(false);
    });
    it('rejects missing result object', () => {
        expect(
            isValidShareInput({
                kind: 'chart',
                symbol: 'AAPL',
                context: { symbol: 'AAPL', displayName: 'A', assetClass: 'x' },
                result: null,
                sharerTier: 'free',
            })
        ).toBe(false);
    });
    it('rejects invalid tier', () => {
        expect(
            isValidShareInput({
                kind: 'chart',
                symbol: 'AAPL',
                context: { symbol: 'AAPL', displayName: 'A', assetClass: 'x' },
                result: {},
                sharerTier: 'enterprise',
            })
        ).toBe(false);
    });
});
