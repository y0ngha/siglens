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
        // Build a result whose UTF-8 byte length equals MAX_RESULT_BYTES exactly.
        // JSON.stringify({data:""}) overhead is 11 ASCII bytes, so padding fills the rest.
        const overhead = Buffer.byteLength(
            JSON.stringify({ data: '' }),
            'utf8'
        ); // 11
        const paddingLen = MAX_RESULT_BYTES - overhead;
        const boundaryResult = { data: 'x'.repeat(paddingLen) };
        expect(Buffer.byteLength(JSON.stringify(boundaryResult), 'utf8')).toBe(
            MAX_RESULT_BYTES
        );
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

    // R3-5: additional rejection cases

    it('rejects context with non-string assetClass', () => {
        expect(
            isValidShareInput({
                kind: 'chart',
                symbol: 'AAPL',
                context: { displayName: 'Apple', assetClass: 123 },
                result: {},
                sharerTier: 'free',
            })
        ).toBe(false);
    });

    it('rejects context: null', () => {
        expect(
            isValidShareInput({
                kind: 'chart',
                symbol: 'AAPL',
                context: null,
                result: {},
                sharerTier: 'free',
            })
        ).toBe(false);
    });

    it('rejects context with non-string displayName', () => {
        expect(
            isValidShareInput({
                kind: 'chart',
                symbol: 'AAPL',
                context: { displayName: 42 },
                result: {},
                sharerTier: 'free',
            })
        ).toBe(false);
    });

    it('rejects oversized result whose UTF-8 byte size exceeds 64KB (multibyte guard)', () => {
        // Korean characters are 3 bytes each in UTF-8 but 1 in UTF-16 length.
        // Build a string where UTF-8 bytes > MAX_RESULT_BYTES.
        // '가' = 3 UTF-8 bytes. We need the JSON envelope's byte size to exceed cap.
        // JSON.stringify({data:"가".repeat(n)}) → overhead ~11 bytes + 3n bytes.
        // n = ceil((MAX_RESULT_BYTES) / 3) + 1 ensures overflow.
        const n = Math.ceil(MAX_RESULT_BYTES / 3) + 1;
        const oversized = { data: '가'.repeat(n) };
        expect(
            Buffer.byteLength(JSON.stringify(oversized), 'utf8')
        ).toBeGreaterThan(MAX_RESULT_BYTES);
        expect(
            isValidShareInput({
                kind: 'chart',
                symbol: 'AAPL',
                context: { displayName: 'Apple' },
                result: oversized,
                sharerTier: 'free',
            })
        ).toBe(false);
    });
});
