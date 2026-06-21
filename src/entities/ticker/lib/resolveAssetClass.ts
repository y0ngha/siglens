import { getAssetInfo } from './getAssetInfo';
import {
    getDescriptor,
    marketProfileOf,
    DEFAULT_MARKET_PROFILE,
    type AssetClass,
    type MarketProfileId,
} from '@/shared/config/marketProfile';

/**
 * Resolves the canonical `MarketProfileId` for a symbol via the cached
 * `getAssetInfo` (DB membership for crypto, populated in Plan 2). Unknown /
 * legacy symbols fall back to `DEFAULT_MARKET_PROFILE` ('us-equity').
 *
 * Prefer this over `resolveAssetClass` when you need both the profile id and
 * the asset class — derive both from the profile to avoid a lossy round-trip:
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

/**
 * Authoritative asset-class resolver for a canonical symbol.
 * Delegates to `resolveMarketProfile` → `getDescriptor`. Unknown/legacy
 * symbols fall back to the default profile's class ('equity').
 */
export async function resolveAssetClass(symbol: string): Promise<AssetClass> {
    const profile = await resolveMarketProfile(symbol);
    return getDescriptor(profile).assetClass;
}
