import { describe, expect, it } from 'vitest';
import {
    fitToEscapedBudget,
    TOOL_RESULT_MAX_CHARS,
    truncateToolResult,
} from '@/app/api/ai/chat/tools/truncate';

describe('truncateToolResult', () => {
    it('4,000자 이하면 그대로', () => {
        const v = { a: 1 };
        expect(truncateToolResult(v)).toBe(v);
    });

    it('초과면 preview + truncated:true, 재직렬화한 envelope도 한도 이내', () => {
        const out = truncateToolResult({
            text: 'x'.repeat(TOOL_RESULT_MAX_CHARS + 100),
        }) as {
            truncated: boolean;
            preview: string;
        };
        expect(out.truncated).toBe(true);
        expect(JSON.stringify(out).length).toBeLessThanOrEqual(
            TOOL_RESULT_MAX_CHARS
        );
    });

    it('surrogate 쌍 경계에서 자르면 lone high surrogate를 한 칸 더 잘라낸다', () => {
        // Place an emoji (surrogate pair) so its HIGH surrogate lands exactly at
        // serialized index `TOOL_RESULT_MAX_CHARS - 1` — the last char a plain
        // `slice(0, TOOL_RESULT_MAX_CHARS)` would keep — with its LOW surrogate
        // one past the cut.
        const prefix = '{"text":"';
        const emoji = '\u{1F600}'; // 😀, one UTF-16 surrogate pair
        const padLength = TOOL_RESULT_MAX_CHARS - prefix.length - 1;
        const pad = 'x'.repeat(padLength);
        const serializedLength = JSON.stringify({
            text: `${pad}${emoji}tail`,
        }).length;
        expect(serializedLength).toBeGreaterThan(TOOL_RESULT_MAX_CHARS);

        const out = truncateToolResult({ text: `${pad}${emoji}tail` }) as {
            truncated: boolean;
            preview: string;
        };
        expect(out.truncated).toBe(true);
        const lastCode = out.preview.charCodeAt(out.preview.length - 1);
        expect(lastCode >= 0xd800 && lastCode <= 0xdbff).toBe(false);
        expect(JSON.stringify(out).length).toBeLessThanOrEqual(
            TOOL_RESULT_MAX_CHARS
        );
    });

    it('quote-heavy 입력을 재직렬화해도 envelope 길이가 한도를 넘지 않는다 (item 6)', () => {
        // `serialized` is already a JSON string, so it is dense with `"` —
        // re-serializing the preview as the `preview` field of the envelope
        // escapes every one of those quotes, roughly doubling size. A naive
        // `slice(0, TOOL_RESULT_MAX_CHARS)` preview would blow the envelope
        // well past the cap once JSON.stringify runs on it again.
        const quoteHeavy = Array.from(
            { length: TOOL_RESULT_MAX_CHARS },
            (_, i) => (i % 2 === 0 ? '"' : 'a')
        ).join('');
        const out = truncateToolResult({ text: quoteHeavy }) as {
            truncated: boolean;
            preview: string;
        };
        expect(out.truncated).toBe(true);
        const reSerializedLength = JSON.stringify(out).length;
        expect(reSerializedLength).toBeLessThanOrEqual(TOOL_RESULT_MAX_CHARS);
        // Sanity: the fix actually did something — a naive full-length slice
        // would have overflowed by roughly the number of quote characters.
        expect(out.preview.length).toBeLessThan(TOOL_RESULT_MAX_CHARS);
    });

    it('fitToEscapedBudget: 이스케이프 후 길이로 예산을 지킨다', () => {
        const quoted = '"'.repeat(100);
        const fitted = fitToEscapedBudget(quoted, 50);
        expect(JSON.stringify(fitted).length - 2).toBeLessThanOrEqual(50);
        expect(fitted.length).toBeGreaterThan(0);
        expect(fitToEscapedBudget('abc', 0)).toBe('');
        expect(fitToEscapedBudget('abcde', 100)).toBe('abcde');
    });
});
