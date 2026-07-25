import 'server-only';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleSeoSnapshotRepository } from '@/entities/seo-snapshot/api';
import type { SeoAnalysisSnapshot } from '../model';

/**
 * ISR static-safe read of a symbol's SEO snapshots (spec 2026-07-24 §5 NB-2).
 * A bare DB read in a page's static path throws DYNAMIC_SERVER_USAGE and forces
 * the [symbol] route dynamic (app/CLAUDE.md axis 1) — so wrap it in
 * staticSymbolCache. Tagged `seo-snapshot:${SYMBOL}` so the pre-warm cron's
 * revalidateTag('seo-snapshot:{SYMBOL}','max') invalidates it on new snapshots.
 * revalidateSeconds should match the calling page's declared `revalidate` literal
 * (a shorter TTL would clamp the route's effective s-maxage). Read failures
 * degrade to [] (fail-open) so the section renders its placeholder, never a 500.
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
                return await new DrizzleSeoSnapshotRepository(db).findBySymbol(
                    upper
                );
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
