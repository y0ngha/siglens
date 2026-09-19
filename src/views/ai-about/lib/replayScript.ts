/**
 * Pure pieces of the `/about` chat replay: the scenario shape, the tiny markup
 * the answer lines carry in `messages/*.json`, and the helpers the player uses
 * to stream a line character by character.
 *
 * The markup is three tags — `<b>`, `<up>`, `<down>` — rather than markdown so
 * translators see balanced, obviously-structural tokens (the same shape
 * next-intl rich text uses) and a mangled pair degrades to visible text
 * instead of silently eating the rest of the line.
 */

export type SegmentTone = 'plain' | 'strong' | 'up' | 'down';

export interface Segment {
    readonly text: string;
    readonly tone: SegmentTone;
}

export interface ReplayLine {
    readonly kind: 'p' | 'li';
    readonly segments: readonly Segment[];
}

export interface ReplayTool {
    readonly label: string;
    /** "{label} 확인 중" already resolved on the server. */
    readonly pendingLabel: string;
    readonly subject: string;
    /** How long the lookup "takes" in the replay, in ms. */
    readonly ms: number;
}

export interface ReplayScenario {
    readonly id: string;
    readonly question: string;
    readonly tools: readonly ReplayTool[];
    readonly lines: readonly ReplayLine[];
    /** The folded one-line tool summary shown once the lookups finish. */
    readonly summary: string;
    readonly sources: readonly string[];
    /** Already prefixed, e.g. "기준 2026-09-18 종가". */
    readonly asOf: string;
}

const TONE_BY_TAG: Readonly<Record<string, SegmentTone>> = {
    b: 'strong',
    up: 'up',
    down: 'down',
};

const TAG = /<(b|up|down)>([^<]*)<\/\1>/g;

export function parseReplayLine(kind: 'p' | 'li', raw: string): ReplayLine {
    const segments: Segment[] = [];
    let last = 0;
    for (const match of raw.matchAll(TAG)) {
        const start = match.index;
        if (start > last)
            segments.push({ text: raw.slice(last, start), tone: 'plain' });
        segments.push({ text: match[2]!, tone: TONE_BY_TAG[match[1]!]! });
        last = start + match[0].length;
    }
    if (last < raw.length)
        segments.push({ text: raw.slice(last), tone: 'plain' });
    return { kind, segments };
}

export function lineLength(line: ReplayLine): number {
    return line.segments.reduce((sum, s) => sum + s.text.length, 0);
}

/** The first `n` visible characters of a line, keeping each piece's tone. */
export function sliceSegments(
    segments: readonly Segment[],
    n: number
): Segment[] {
    const out: Segment[] = [];
    let left = n;
    for (const segment of segments) {
        if (left <= 0) break;
        const text = segment.text.slice(0, left);
        out.push(
            text.length === segment.text.length ? segment : { ...segment, text }
        );
        left -= text.length;
    }
    return out;
}

export interface LineGroup {
    readonly kind: ReplayLine['kind'];
    readonly items: { readonly line: ReplayLine; readonly index: number }[];
}

/** Consecutive lines of the same kind render as one `<ul>` or one run of `<p>`. */
export function groupLines(lines: readonly ReplayLine[]): LineGroup[] {
    const groups: LineGroup[] = [];
    lines.forEach((line, index) => {
        const last = groups.at(-1);
        if (last && last.kind === line.kind) last.items.push({ line, index });
        else groups.push({ kind: line.kind, items: [{ line, index }] });
    });
    return groups;
}

/** A random index other than `prev`, so the same question never plays twice in a row. */
export function pickNextIndex(
    length: number,
    prev: number,
    random: () => number = Math.random
): number {
    if (length <= 1) return 0;
    // Draw from the other `length - 1` slots and shift past `prev`.
    const draw = Math.min(Math.floor(random() * (length - 1)), length - 2);
    return draw >= prev ? draw + 1 : draw;
}

export interface LineReveal {
    /** Visible characters of this line; 0 means not shown yet. */
    readonly shown: number;
    /** The streaming caret sits at the end of this line. */
    readonly caret: boolean;
}

/**
 * Spreads `chars` streamed characters over the lines in order. While
 * `streaming`, the caret goes on the last line that has anything shown.
 */
export function revealLines(
    lines: readonly ReplayLine[],
    chars: number,
    streaming: boolean
): LineReveal[] {
    let left = chars;
    const shown = lines.map(line => {
        const n = Math.max(0, Math.min(lineLength(line), left));
        left -= n;
        return n;
    });
    const caretAt = streaming ? shown.findLastIndex(n => n > 0) : -1;
    return shown.map((n, i) => ({ shown: n, caret: i === caretAt }));
}
