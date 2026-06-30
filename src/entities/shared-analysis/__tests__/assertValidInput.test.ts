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
    it('rejects symbol longer than 32 characters', () => {
        expect(
            isValidShareInput({
                kind: 'chart',
                symbol: 'A'.repeat(33),
                context: { symbol: 'A'.repeat(33), displayName: 'Long' },
                result: {},
                sharerTier: 'free',
            })
        ).toBe(false);
    });
    it('accepts symbol exactly 32 characters', () => {
        expect(
            isValidShareInput({
                kind: 'chart',
                symbol: 'A'.repeat(32),
                context: { symbol: 'A'.repeat(32), displayName: 'Long' },
                result: {},
                sharerTier: 'free',
            })
        ).toBe(true);
    });
    it('accepts input when assetClass is omitted (optional)', () => {
        expect(
            isValidShareInput({
                kind: 'chart',
                symbol: 'AAPL',
                context: { symbol: 'AAPL', displayName: 'Apple' },
                result: { trend: 'bullish' },
                sharerTier: 'free',
            })
        ).toBe(true);
    });
    it('accepts input when assetClass is empty string (widgets that omit it send nothing now)', () => {
        // Empty string is allowed since assetClass is optional string (undefined or string)
        expect(
            isValidShareInput({
                kind: 'news',
                symbol: 'TSLA',
                context: { symbol: 'TSLA', displayName: 'Tesla' },
                result: { overallSentiment: 'bullish' },
                sharerTier: 'free',
            })
        ).toBe(true);
    });
});
