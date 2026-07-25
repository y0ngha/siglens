import 'server-only';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleSeoSnapshotRepository } from '@/entities/seo-snapshot/api';
import { SNAPSHOT_MAX_AGE_MS, type SeoAnalysisSnapshot } from '../model';

/**
 * ISR static-safe read of a symbol's SEO snapshots (spec 2026-07-24 §5 NB-2).
 * A bare DB read in a page's static path throws DYNAMIC_SERVER_USAGE and forces
 * the [symbol] route dynamic (app/CLAUDE.md axis 1) — so wrap it in
 * staticSymbolCache. Tagged `seo-snapshot:${SYMBOL}` so the pre-warm cron's
 * revalidateTag('seo-snapshot:{SYMBOL}','max') invalidates it on new snapshots.
 * revalidateSeconds should match the calling page's declared `revalidate` literal
 * (a shorter TTL would clamp the route's effective s-maxage). Read failures
 * degrade to [] (fail-open) so the section renders its placeholder, never a 500.
 *
 * FIX D (audit): rows older than {@link SNAPSHOT_MAX_AGE_MS} are dropped before
 * returning. Without this, a dead/stalled pre-warm cron would let this read
 * path serve arbitrarily old analysis prose forever under a "전일 장마감 기준"
 * (as-of-yesterday-close) caption — an accuracy/E-E-A-T liability on a finance
 * site, and the `hasSnapshot` indexability gate (consumed by callers) would
 * stay permanently indexable on a stale row. Filtering to `[]` degrades to the
 * existing placeholder path, which is already the safe fail-open behavior —
 * no new failure mode is introduced.
 */
export function getSeoSnapshotsStatic(
    symbol: string,
    revalidateSeconds: number
): Promise<SeoAnalysisSnapshot[]> {
    const upper = symbol.toUpperCase();
    return staticSymbolCache(
        ['seo-snapshots', upper],
        upper,
        async () => {
            try {
                const { db } = getDatabaseClient();
                const rows = await new DrizzleSeoSnapshotRepository(
                    db
                ).findBySymbol(upper);
                const cutoff = Date.now() - SNAPSHOT_MAX_AGE_MS;
                const fresh = rows.filter(
                    row => row.generatedAt.getTime() >= cutoff
                );
                const droppedCount = rows.length - fresh.length;
                if (droppedCount > 0) {
                    // FIX D (audit): the operator's only signal that the cron
                    // has been dead long enough for §max-age to bite — absent
                    // this, prose would just silently stop appearing with no
                    // explanation in the logs.
                    console.warn(
                        `[getSeoSnapshotsStatic] ${upper}: dropped ${droppedCount} row(s) older than ${SNAPSHOT_MAX_AGE_MS}ms (cron likely stalled)`
                    );
                }
                // Observability (audit fix FIX 7): if every renderer
                // null-renders (malformed content, a core schema drift, a
                // tab-key mismatch), the system otherwise emits ZERO
                // output — indistinguishable from "working as intended,
                // just no snapshot yet". This runs once per symbol per
                // cache-fill (inside the unstable_cache fetcher, not per
                // request), so volume is bounded — greppable in CloudWatch
                // `/siglens/app` as ground truth that reads are happening.
                console.info(
                    `[getSeoSnapshotsStatic] ${upper}: ${fresh.length} snapshot row(s)`
                );
                return fresh;
            } catch (error) {
                console.error(
                    '[getSeoSnapshotsStatic] read failed, degrading:',
                    error
                );
                return [];
            }
        },
        [`seo-snapshot:${upper}`],
        revalidateSeconds
    );
}
