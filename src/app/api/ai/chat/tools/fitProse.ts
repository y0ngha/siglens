import 'server-only';
import { CACHED_ANALYSIS_MAX_CHARS, fitToEscapedBudget } from './truncate';

/**
 * Reserves room for envelope JSON punctuation/escaping when splitting the
 * remaining truncation budget across prose leaves. Mirrors
 * `BODY_BUDGET_SAFETY_MARGIN` in getNews.ts.
 */
const PROSE_BUDGET_SAFETY_MARGIN = 200;

export type ProseSpec =
    | { kind: 'text'; value: string | null | undefined }
    // `unknown` (not `string`) — a `list` leaf may be an array of plain
    // strings (overall's bullets) or of objects (options' `perExpiration`
    // commentary entries, technical's `patterns`/`candlePatterns`/
    // `strategies`); either way each item is dropped or kept whole.
    | { kind: 'list'; value: readonly unknown[] | undefined };

/**
 * Fits variable-length prose/bullet leaves of an already-built `envelope`
 * into whatever is left of `CACHED_ANALYSIS_MAX_CHARS` — the ceiling both
 * `get_cached_analysis` and `run_fresh_analysis` protect their analysis
 * payload against (the per-turn allowance may lower the executor's actual
 * cap further, but fitting to this constant is the same trade every caller
 * already makes). Only invoked when the full envelope (with the untouched
 * leaves) overflows the budget — a realistic technical/overall analysis
 * usually fits as-is once the caller's projection has already dropped the
 * bulk fields, so this only shaves what's actually over.
 *
 * Splits the overflow evenly across `fields`. `text` fields are cut with
 * `fitToEscapedBudget` (mirrors getNews.ts's body-fitting). `list` fields
 * keep bullets in original order and DROP trailing ones that don't fit
 * whole rather than truncating a bullet mid-sentence — the same "keep the
 * top, drop the tail" rule webSearch uses for its top-N results.
 *
 * Shared by `run_fresh_analysis` (technical/overall/options) and
 * `get_cached_analysis` (technical, Redis peek path) so an oversized
 * payload is protected identically regardless of which tool produced it —
 * without this, it would fall through to the registry-level
 * `truncateToolResult`, which collapses the WHOLE payload into a front-cut
 * preview blob (losing `keyLevels`/`priceTargets` too).
 */
export function fitProse(
    envelope: unknown,
    fields: Record<string, ProseSpec>
): Record<string, string | unknown[]> {
    const keys = Object.keys(fields);
    const out: Record<string, string | unknown[]> = {};
    const asIs = (spec: ProseSpec): string | unknown[] =>
        spec.kind === 'text' ? (spec.value ?? '') : [...(spec.value ?? [])];
    const overflow =
        JSON.stringify(envelope).length - CACHED_ANALYSIS_MAX_CHARS;
    if (overflow <= 0 || keys.length === 0) {
        for (const key of keys) out[key] = asIs(fields[key]!);
        return out;
    }
    let currentLeavesSize = 0;
    for (const key of keys)
        currentLeavesSize += JSON.stringify(asIs(fields[key]!)).length;
    const targetLeavesSize = Math.max(
        0,
        currentLeavesSize - overflow - PROSE_BUDGET_SAFETY_MARGIN
    );
    const share = Math.floor(targetLeavesSize / keys.length);
    for (const key of keys) {
        const field = fields[key]!;
        if (field.kind === 'text') {
            out[key] = fitToEscapedBudget(field.value ?? '', share);
            continue;
        }
        const kept: unknown[] = [];
        let used = 2; // '[' + ']'
        for (const item of field.value ?? []) {
            const cost = JSON.stringify(item).length + 1; // + separating comma
            if (used + cost > share) break;
            kept.push(item);
            used += cost;
        }
        out[key] = kept;
    }
    return out;
}
