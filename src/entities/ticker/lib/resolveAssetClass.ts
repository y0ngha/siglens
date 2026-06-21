import { getAssetInfo } from '@/entities/ticker/lib/getAssetInfo';
import {
    getDescriptor,
    marketProfileOf,
    DEFAULT_MARKET_PROFILE,
    type AssetClass,
} from '@/shared/config/marketProfile';

/**
 * Authoritative asset-class resolver for a canonical symbol.
 * Uses the cached `getAssetInfo` (DB membership for crypto, populated in Plan 2)
 * → market profile → descriptor.assetClass. Unknown/legacy symbols fall back to
 * the default profile's class ('equity').
 */
export async function resolveAssetClass(symbol: string): Promise<AssetClass> {
    const assetInfo = await getAssetInfo(symbol);
    const profile = assetInfo
        ? marketProfileOf(assetInfo)
        : DEFAULT_MARKET_PROFILE;
    return getDescriptor(profile).assetClass;
}
