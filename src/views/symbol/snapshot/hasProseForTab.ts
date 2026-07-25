import type { SeoSnapshotTab } from '@/entities/seo-snapshot';
import { hasTechnicalProse } from './renderers/TechnicalSnapshotProse';
import { hasOverallProse } from './renderers/OverallSnapshotProse';
import { hasCongressProse } from './renderers/CongressSnapshotProse';
import { hasFundamentalProse } from './renderers/FundamentalSnapshotProse';
import { hasFinancialsProse } from './renderers/FinancialsSnapshotProse';
import { hasNewsProse } from './renderers/NewsSnapshotProse';
import { hasOptionsProse } from './renderers/OptionsSnapshotProse';

/**
 * Tab → renderability predicate map (audit fix FIX 1). Each entry delegates to
 * the SAME `has*Prose` predicate its `*SnapshotProse` renderer uses internally
 * to decide whether to return `null` — so this map and the renderer it backs
 * can never disagree on whether a given row's `content` produces visible
 * prose.
 *
 * Consumed by `src/app/[symbol]/symbolIndexabilityMetadata.ts` to gate
 * indexability on RENDERABILITY, not row existence: a `seo_analysis_snapshots`
 * row can exist for a tab while its `content` fails that tab's narrowing (a
 * malformed JSONB write, a core schema drift) — in that case the page body
 * falls back to the thin degraded shell, and this map must report `false` so
 * the page is not falsely marked indexable.
 *
 * Lives in `src/views/**` (not `src/entities/seo-snapshot`) because it imports
 * the `*SnapshotProse` renderers, which are a `views` concern; `app/` may
 * import `views/**` directly.
 */
const PROSE_PREDICATE_BY_TAB: Record<
    SeoSnapshotTab,
    (content: unknown) => boolean
> = {
    technical: hasTechnicalProse,
    overall: hasOverallProse,
    congress: hasCongressProse,
    fundamental: hasFundamentalProse,
    financials: hasFinancialsProse,
    news: hasNewsProse,
    options: hasOptionsProse,
};

/**
 * Returns whether `content` renders visible prose for the given snapshot
 * `tab`. `tab` is typed as `SeoSnapshotTab`, but this function is called with
 * DB-sourced row data (`getSeoSnapshotsStatic` results) that isn't
 * compiler-checked at the call site — an unrecognized tab string must return
 * `false`, not throw, so a malformed/legacy row can never crash metadata
 * generation (PR #698 round-2 review FIX 1).
 */
export function hasProseForTab(tab: SeoSnapshotTab, content: unknown): boolean {
    const predicate = PROSE_PREDICATE_BY_TAB[tab];
    return predicate !== undefined && predicate(content);
}
