import {
    isValidShareInput,
    MAX_DISPLAY_NAME_LENGTH,
    MAX_RESULT_BYTES,
} from '@/entities/shared-analysis/server/assertValidInput';
import { MAX_CHART_BARS } from '@/entities/shared-analysis';

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

    // ── chartBars validation ──────────────────────────────────────────────────

    const makeBar = (i: number) => ({
        time: 1700000000 + i * 86400,
        open: 150,
        high: 155,
        low: 148,
        close: 153,
        volume: 1000000,
    });

    it('accepts chart input with valid chartBars', () => {
        expect(
            isValidShareInput({
                kind: 'chart',
                symbol: 'AAPL',
                context: { symbol: 'AAPL', displayName: 'Apple' },
                result: { trend: 'bullish' },
                sharerTier: 'free',
                chartBars: [makeBar(0), makeBar(1)],
            })
        ).toBe(true);
    });

    it('accepts chart input without chartBars (optional)', () => {
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

    it('accepts chart input with exactly MAX_CHART_BARS bars', () => {
        const bars = Array.from({ length: MAX_CHART_BARS }, (_, i) =>
            makeBar(i)
        );
        expect(
            isValidShareInput({
                kind: 'chart',
                symbol: 'AAPL',
                context: { symbol: 'AAPL', displayName: 'Apple' },
                result: { trend: 'bullish' },
                sharerTier: 'free',
                chartBars: bars,
            })
        ).toBe(true);
    });

    it('rejects chart input with chartBars exceeding MAX_CHART_BARS', () => {
        const bars = Array.from({ length: MAX_CHART_BARS + 1 }, (_, i) =>
            makeBar(i)
        );
        expect(
            isValidShareInput({
                kind: 'chart',
                symbol: 'AAPL',
                context: { symbol: 'AAPL', displayName: 'Apple' },
                result: { trend: 'bullish' },
                sharerTier: 'free',
                chartBars: bars,
            })
        ).toBe(false);
    });

    it('rejects chart input with empty chartBars array', () => {
        expect(
            isValidShareInput({
                kind: 'chart',
                symbol: 'AAPL',
                context: { symbol: 'AAPL', displayName: 'Apple' },
                result: { trend: 'bullish' },
                sharerTier: 'free',
                chartBars: [],
            })
        ).toBe(false);
    });

    it('rejects chart input with non-array chartBars', () => {
        expect(
            isValidShareInput({
                kind: 'chart',
                symbol: 'AAPL',
                context: { symbol: 'AAPL', displayName: 'Apple' },
                result: { trend: 'bullish' },
                sharerTier: 'free',
                chartBars: 'not-an-array',
            })
        ).toBe(false);
    });

    it('rejects non-chart kind with chartBars present', () => {
        expect(
            isValidShareInput({
                kind: 'news',
                symbol: 'AAPL',
                context: { symbol: 'AAPL', displayName: 'Apple' },
                result: { overallSentiment: 'bullish' },
                sharerTier: 'free',
                chartBars: [makeBar(0)],
            })
        ).toBe(false);
    });

    // ── Bar element shape validation ──────────────────────────────────────────

    it('rejects chart input where a bar element is missing required numeric fields', () => {
        const malformedBar = { time: 1700000000, open: 150 }; // missing high/low/close
        expect(
            isValidShareInput({
                kind: 'chart',
                symbol: 'AAPL',
                context: { symbol: 'AAPL', displayName: 'Apple' },
                result: { trend: 'bullish' },
                sharerTier: 'free',
                chartBars: [malformedBar],
            })
        ).toBe(false);
    });

    it('rejects chart input where a bar element has a non-numeric field', () => {
        const malformedBar = {
            time: 1700000000,
            open: 'not-a-number',
            high: 155,
            low: 148,
            close: 153,
            volume: 1000000,
        };
        expect(
            isValidShareInput({
                kind: 'chart',
                symbol: 'AAPL',
                context: { symbol: 'AAPL', displayName: 'Apple' },
                result: { trend: 'bullish' },
                sharerTier: 'free',
                chartBars: [malformedBar],
            })
        ).toBe(false);
    });

    it('rejects chart input where a bar element has a non-finite number (NaN)', () => {
        const malformedBar = {
            time: 1700000000,
            open: NaN,
            high: 155,
            low: 148,
            close: 153,
            volume: 1000000,
        };
        expect(
            isValidShareInput({
                kind: 'chart',
                symbol: 'AAPL',
                context: { symbol: 'AAPL', displayName: 'Apple' },
                result: { trend: 'bullish' },
                sharerTier: 'free',
                chartBars: [malformedBar],
            })
        ).toBe(false);
    });

    it('rejects chart input where a bar element has Infinity in a numeric field', () => {
        const malformedBar = {
            time: 1700000000,
            open: 150,
            high: Infinity,
            low: 148,
            close: 153,
            volume: 1000000,
        };
        expect(
            isValidShareInput({
                kind: 'chart',
                symbol: 'AAPL',
                context: { symbol: 'AAPL', displayName: 'Apple' },
                result: { trend: 'bullish' },
                sharerTier: 'free',
                chartBars: [malformedBar],
            })
        ).toBe(false);
    });

    it('accepts valid chartBars with all required numeric OHLCV fields', () => {
        const validBars = [makeBar(0), makeBar(1), makeBar(2)];
        expect(
            isValidShareInput({
                kind: 'chart',
                symbol: 'AAPL',
                context: { symbol: 'AAPL', displayName: 'Apple' },
                result: { trend: 'bullish' },
                sharerTier: 'free',
                chartBars: validBars,
            })
        ).toBe(true);
    });

    it('rejects chart input where a bar element is a primitive (not an object)', () => {
        expect(
            isValidShareInput({
                kind: 'chart',
                symbol: 'AAPL',
                context: { symbol: 'AAPL', displayName: 'Apple' },
                result: { trend: 'bullish' },
                sharerTier: 'free',
                chartBars: [42],
            })
        ).toBe(false);
    });

    // ── displayName / assetClass length cap ───────────────────────────────────

    it('rejects context.displayName exceeding MAX_DISPLAY_NAME_LENGTH', () => {
        expect(
            isValidShareInput({
                kind: 'chart',
                symbol: 'AAPL',
                context: {
                    displayName: 'A'.repeat(MAX_DISPLAY_NAME_LENGTH + 1),
                },
                result: {},
                sharerTier: 'free',
            })
        ).toBe(false);
    });

    it('accepts context.displayName exactly at MAX_DISPLAY_NAME_LENGTH', () => {
        expect(
            isValidShareInput({
                kind: 'chart',
                symbol: 'AAPL',
                context: {
                    displayName: 'A'.repeat(MAX_DISPLAY_NAME_LENGTH),
                },
                result: {},
                sharerTier: 'free',
            })
        ).toBe(true);
    });

    it('rejects context.assetClass exceeding MAX_DISPLAY_NAME_LENGTH', () => {
        expect(
            isValidShareInput({
                kind: 'chart',
                symbol: 'AAPL',
                context: {
                    displayName: 'Apple',
                    assetClass: 'x'.repeat(MAX_DISPLAY_NAME_LENGTH + 1),
                },
                result: {},
                sharerTier: 'free',
            })
        ).toBe(false);
    });

    it('accepts context.assetClass exactly at MAX_DISPLAY_NAME_LENGTH', () => {
        expect(
            isValidShareInput({
                kind: 'chart',
                symbol: 'AAPL',
                context: {
                    displayName: 'Apple',
                    assetClass: 'x'.repeat(MAX_DISPLAY_NAME_LENGTH),
                },
                result: {},
                sharerTier: 'free',
            })
        ).toBe(true);
    });
});
