import type { AssetInfo } from '@/shared/lib/types';

export type SymbolIndexabilityRoute = 'chart';

export interface SymbolIndexabilityInput {
    symbol: string;
    route: SymbolIndexabilityRoute;
    assetInfo: AssetInfo | null;
    degraded: boolean;
}

export type SymbolIndexabilityReason =
    | 'popular'
    | 'curated-crypto'
    | 'approved-longtail'
    | 'invalid-symbol'
    | 'asset-missing'
    | 'degraded'
    | 'longtail-default-blocked';

export interface SymbolIndexabilityDecision {
    indexable: boolean;
    reason: SymbolIndexabilityReason;
}
