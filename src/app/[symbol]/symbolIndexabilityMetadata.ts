import { evaluateSymbolIndexability } from '@/entities/symbol-indexability';
import { NOINDEX_SYMBOL_METADATA } from '@/shared/lib/seo';
import type { AssetInfo } from '@/shared/lib/types';
import type { Metadata } from 'next';

interface BlockedSymbolMetadataInput {
    symbol: string;
    assetInfo: AssetInfo | null;
    degraded: boolean;
}

export function getBlockedSymbolMetadata({
    symbol,
    assetInfo,
    degraded,
}: BlockedSymbolMetadataInput): Metadata | null {
    const decision = evaluateSymbolIndexability({
        symbol,
        assetInfo,
        degraded,
    });

    return decision.indexable ? null : NOINDEX_SYMBOL_METADATA;
}
