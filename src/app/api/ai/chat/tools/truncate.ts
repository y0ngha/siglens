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
function buildTruncatedEnvelope(
    serialized: string,
    maxChars: number
): {
    truncated: true;
    preview: string;
} {
    let previewLen = maxChars;
    const MAX_ITERATIONS = 30;
    for (let i = 0; i < MAX_ITERATIONS && previewLen > 0; i++) {
        const preview = safeSliceUtf16(serialized, previewLen);
        const envelope = { truncated: true as const, preview };
        const overflow = JSON.stringify(envelope).length - maxChars;
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

export function truncateToolResult(
    value: unknown,
    maxChars: number = TOOL_RESULT_MAX_CHARS
): unknown {
    const serialized = JSON.stringify(value);
    if (serialized === undefined || serialized.length <= maxChars) return value;
    return buildTruncatedEnvelope(serialized, maxChars);
}

/**
 * `get_cached_analysis` (and `run_fresh_analysis`, same shape) carries a whole analysis plus its plain-language
 * rewrite. Measured on production snapshots (2026-09-13): 3 of 7 popular
 * symbol/tab pairs exceeded 4,000 chars (AAPL technical 6,000, AAPL overall
 * 5,431, NVDA overall 8,297), so the model got a front-cut preview — the
 * plain rewrite and only ~900 chars of the actual analysis. Its own ceiling
 * keeps both whole.
 *
 * Nothing in core bounds the size of the CURRENT turn: history windowing
 * applies only to earlier turns, and every step resends the whole growing
 * message list (up to 6 steps / 8 tool calls). So the larger ceiling is
 * paired with a per-turn allowance (`CACHED_ANALYSIS_TURN_BUDGET_CHARS`):
 * two full analyses per turn, after which further lookups fall back to the
 * default 4,000 cut.
 */
export const CACHED_ANALYSIS_MAX_CHARS = 12_000;
export const CACHED_ANALYSIS_TURN_BUDGET_CHARS = 2 * CACHED_ANALYSIS_MAX_CHARS;
