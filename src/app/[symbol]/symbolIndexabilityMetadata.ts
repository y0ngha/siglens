import { evaluateSymbolIndexability } from '@/entities/symbol-indexability';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';
import { NOINDEX_SYMBOL_METADATA } from '@/shared/lib/seo';
import type { AssetInfo } from '@/shared/lib/types';
import type { Metadata } from 'next';

interface BlockedSymbolMetadataInput {
    symbol: string;
    assetInfo: AssetInfo | null;
    degraded: boolean;
    revalidateSeconds: number;
}

export async function getBlockedSymbolMetadata({
    symbol,
    assetInfo,
    degraded,
    revalidateSeconds,
}: BlockedSymbolMetadataInput): Promise<Metadata | null> {
    // hasSnapshot lookup only when degraded (avoid a DB/cache read on the normal path).
    // Read via the ISR-safe static helper so generateMetadata stays static-cacheable.
    const hasSnapshot = degraded
        ? (await getSeoSnapshotsStatic(symbol, revalidateSeconds)).length > 0
        : undefined;

    const decision = evaluateSymbolIndexability({
        symbol,
        assetInfo,
        degraded,
        hasSnapshot,
    });

    return decision.indexable ? null : NOINDEX_SYMBOL_METADATA;
}
