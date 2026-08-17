import { stripSnapshotMarkdown } from './stripSnapshotMarkdown';

/**
 * Narrows an `unknown` field to a trimmed, markdown-stripped string array —
 * the shared shape for every `*Ko` bullet/list field on the seven
 * `*SnapshotProse` renderers (`riskFactorsKo`, `notableMembersKo`,
 * `keyEventsKo`, `upcomingEventsKo`, `technicalBulletsKo`, ...). Extracted
 * from `OverallSnapshotProse` (PR #698 round-2 review FIX 2) — each renderer
 * previously re-implemented this same
 * `Array.isArray` → filter strings → `stripSnapshotMarkdown` → trim → drop
 * empties pipeline inline, which let a copy-paste drift undetected.
 *
 * Non-array input (including `null`/`undefined`) narrows to `[]` rather than
 * throwing, matching every renderer's "no prose source → render nothing,
 * fall back to the placeholder" contract.
 */
export function narrowStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap(item => {
        if (typeof item !== 'string') return [];
        const cleaned = stripSnapshotMarkdown(item).trim();
        return cleaned.length > 0 ? [cleaned] : [];
    });
}
