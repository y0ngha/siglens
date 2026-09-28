import { getAssetInfo } from './getAssetInfo';
import {
    marketProfileOf,
    DEFAULT_MARKET_PROFILE,
} from '@/shared/config/marketProfile/registry';
import { type MarketProfileId } from '@/shared/config/marketProfile/types';

/**
 * Resolves the canonical `MarketProfileId` for a symbol via the cached
 * `getAssetInfo` (DB membership for crypto). Unknown / legacy symbols fall
 * back to `DEFAULT_MARKET_PROFILE` ('us-equity').
 *
 * Callers that also need the asset class derive it from the profile via
 * `getDescriptor` to avoid a lossy round-trip:
 *
 * ```ts
 * const profile = await resolveMarketProfile(symbol);
 * const { assetClass } = getDescriptor(profile);
 * const session = sessionSpecFor(profile);
 * ```
 */
export async function resolveMarketProfile(
    symbol: string
): Promise<MarketProfileId> {
    const assetInfo = await getAssetInfo(symbol);
    return assetInfo ? marketProfileOf(assetInfo) : DEFAULT_MARKET_PROFILE;
}
