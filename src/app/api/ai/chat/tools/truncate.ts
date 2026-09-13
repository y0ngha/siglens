/** Single truncation rule (spec §7): what the model sees is what gets stored. */
export const TOOL_RESULT_MAX_CHARS = 4_000;

/**
 * Cuts at `maxChars` UTF-16 code units, then backs off one more unit if that
 * lands mid-surrogate-pair (a lone high surrogate at the tail is invalid
 * UTF-16 and corrupts downstream JSON/text handling for emoji or rare CJK
 * extension characters carried in news/article text).
 */
export function safeSliceUtf16(text: string, maxChars: number): string {
    if (maxChars <= 0) return '';
    const cut = text.slice(0, maxChars);
    const lastCode = cut.charCodeAt(cut.length - 1);
    const isHighSurrogate = lastCode >= 0xd800 && lastCode <= 0xdbff;
    return isHighSurrogate ? cut.slice(0, -1) : cut;
}

/**
 * Largest prefix of `text` whose JSON-ESCAPED length fits `maxEscapedChars`.
 * Budgeting on raw `.length` under-counts: in JSON a `"` becomes `\"` and a
 * newline `\n`, so ordinary prose runs ~15% longer once serialized. Callers
 * that split a byte budget across fields (news bodies) must reserve the
 * escaped size, otherwise the whole structured payload overflows and the
 * registry collapses it into a front-cut preview blob.
 */
export function fitToEscapedBudget(
    text: string,
    maxEscapedChars: number
): string {
    if (maxEscapedChars <= 0) return '';
    let len = Math.min(text.length, maxEscapedChars);
    const MAX_ITERATIONS = 30;
    for (let i = 0; i < MAX_ITERATIONS && len > 0; i++) {
        const slice = safeSliceUtf16(text, len);
        // `- 2` drops the surrounding quotes JSON.stringify adds.
        const overflow = JSON.stringify(slice).length - 2 - maxEscapedChars;
        if (overflow <= 0) return slice;
        len = Math.max(Math.floor(len / 2), len - overflow);
    }
    return '';
}

/**
 * Builds `{ truncated: true, preview }` so that RE-serializing the envelope
 * (core wraps every tool result in `JSON.stringify` before it reaches the
 * model) still fits `TOOL_RESULT_MAX_CHARS` — not just the raw preview
 * string. Quote/backslash-heavy `serialized` input (it's already a JSON
 * string, so it's full of `"`) roughly doubles in size once JSON.stringify
 * escapes it a second time, so a naive `slice(0, MAX)` preview could produce
 * an envelope up to ~2x the budget. Shrinks by the measured overflow each
 * iteration, which converges in a handful of steps because the escape
 * expansion ratio is bounded (each `"`/`\` adds exactly one extra char).
 */
function buildTruncatedEnvelope(serialized: string): {
    truncated: true;
    preview: string;
} {
    let previewLen = TOOL_RESULT_MAX_CHARS;
    const MAX_ITERATIONS = 30;
    for (let i = 0; i < MAX_ITERATIONS && previewLen > 0; i++) {
        const preview = safeSliceUtf16(serialized, previewLen);
        const envelope = { truncated: true as const, preview };
        const overflow =
            JSON.stringify(envelope).length - TOOL_RESULT_MAX_CHARS;
        if (overflow <= 0) return envelope;
        // Never let one subtraction jump past 0: `overflow` counts ESCAPED units
        // while `previewLen` counts raw ones, so a quote-heavy payload could
        // otherwise leave the model an empty preview. Halving bounds the step.
        previewLen = Math.max(
            Math.floor(previewLen / 2),
            previewLen - Math.max(overflow, 1)
        );
    }
    return { truncated: true, preview: '' };
}

export function truncateToolResult(value: unknown): unknown {
    const serialized = JSON.stringify(value);
    if (serialized === undefined || serialized.length <= TOOL_RESULT_MAX_CHARS)
        return value;
    return buildTruncatedEnvelope(serialized);
}
