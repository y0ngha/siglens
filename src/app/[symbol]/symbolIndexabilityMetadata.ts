import { evaluateSymbolIndexability } from '@/entities/symbol-indexability';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';
import type { SeoSnapshotTab } from '@/entities/seo-snapshot';
import { NOINDEX_SYMBOL_METADATA } from '@/shared/lib/seo';
import type { AssetInfo } from '@/shared/lib/types';
import type { Metadata } from 'next';

interface BlockedSymbolMetadataInput {
    symbol: string;
    assetInfo: AssetInfo | null;
    degraded: boolean;
    revalidateSeconds: number;
    /**
     * The snapshot tab this route renders. `hasSnapshot` is scoped to rows
     * matching THIS tab only — a row for a different tab must never flip a
     * degraded page indexable (bug: a whitelisted symbol's `/congress` with
     * only a `technical` row was marked indexable while its body renders the
     * thin degraded shell — spec 2026-07-24 audit fix).
     *
     * Omit for routes with no snapshot renderer (`fear-greed`, `position`) —
     * `hasSnapshot` then stays `undefined` and the existing degraded→noindex
     * behavior is preserved (the DB read is skipped entirely).
     */
    tab?: SeoSnapshotTab;
}

export async function getBlockedSymbolMetadata({
    symbol,
    assetInfo,
    degraded,
    revalidateSeconds,
    tab,
}: BlockedSymbolMetadataInput): Promise<Metadata | null> {
    // hasSnapshot lookup only when degraded AND the route has a snapshot tab
    // (avoid a DB/cache read on the normal path, and never read for
    // tab-less routes). Read via the ISR-safe static helper so
    // generateMetadata stays static-cacheable.
    const hasSnapshot =
        degraded && tab !== undefined
            ? (await getSeoSnapshotsStatic(symbol, revalidateSeconds)).some(
                  s => s.tab === tab
              )
            : undefined;

    const decision = evaluateSymbolIndexability({
        symbol,
        assetInfo,
        degraded,
        hasSnapshot,
    });

    return decision.indexable ? null : NOINDEX_SYMBOL_METADATA;
}
