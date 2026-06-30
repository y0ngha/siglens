import {
    isValidShareInput,
    MAX_RESULT_BYTES,
} from '@/entities/shared-analysis/server/assertValidInput';

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

    // R2-2: payload size cap
    it('rejects result that exceeds MAX_RESULT_BYTES', () => {
        // Build a result object whose JSON representation exceeds the cap.
        const oversizedResult = { data: 'x'.repeat(MAX_RESULT_BYTES + 1) };
        expect(
            isValidShareInput({
                kind: 'chart',
                symbol: 'AAPL',
                context: { symbol: 'AAPL', displayName: 'Apple' },
                result: oversizedResult,
                sharerTier: 'free',
            })
        ).toBe(false);
    });

    it('accepts result that is exactly at MAX_RESULT_BYTES boundary', () => {
        // Construct a result object whose JSON serialization is exactly MAX_RESULT_BYTES.
        // JSON.stringify({data:""}) = '{"data":""}' = 11 chars (overhead).
        // So padding = MAX_RESULT_BYTES - 11 yields a total of exactly MAX_RESULT_BYTES.
        const overhead = JSON.stringify({ data: '' }).length; // 11
        const paddingLen = MAX_RESULT_BYTES - overhead;
        const boundaryResult = { data: 'x'.repeat(paddingLen) };
        expect(JSON.stringify(boundaryResult).length).toBe(MAX_RESULT_BYTES);
        expect(
            isValidShareInput({
                kind: 'chart',
                symbol: 'AAPL',
                context: { symbol: 'AAPL', displayName: 'Apple' },
                result: boundaryResult,
                sharerTier: 'free',
            })
        ).toBe(true);
    });
});
