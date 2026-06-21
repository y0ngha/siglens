import type { AssetInfo } from '@/shared/lib/types';
import type { MarketProfileDescriptor, MarketProfileId } from './types';
import { US_EQUITY_DESCRIPTOR } from './usEquity';
import { CRYPTO_DESCRIPTOR } from './crypto';

export const DEFAULT_MARKET_PROFILE: MarketProfileId = 'us-equity';

const REGISTRY: Record<MarketProfileId, MarketProfileDescriptor> = {
    'us-equity': US_EQUITY_DESCRIPTOR,
    crypto: CRYPTO_DESCRIPTOR,
};

/** Look up the descriptor for a market-profile id. */
export function getDescriptor(id: MarketProfileId): MarketProfileDescriptor {
    return REGISTRY[id];
}

/** Resolve an AssetInfo's market profile, defaulting legacy/profile-less assets to us-equity. */
export function marketProfileOf(asset: AssetInfo): MarketProfileId {
    return asset.marketProfile ?? DEFAULT_MARKET_PROFILE;
}
