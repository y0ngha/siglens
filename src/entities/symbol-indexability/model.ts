import type { AssetInfo } from '@/shared/lib/types';

export interface SymbolIndexabilityInput {
    symbol: string;
    assetInfo: AssetInfo | null;
    degraded: boolean;
    hasSnapshot?: boolean;
}

export type SymbolIndexabilityReason =
    | 'popular'
    | 'curated-crypto'
    | 'approved-longtail'
    | 'invalid-symbol'
    | 'asset-missing'
    | 'degraded'
    | 'degraded-with-snapshot'
    | 'longtail-default-blocked';

export interface SymbolIndexabilityDecision {
    indexable: boolean;
    reason: SymbolIndexabilityReason;
}
