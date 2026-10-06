import type { AssetInfo } from '@/shared/lib/types';
import { getAssetInfo } from './getAssetInfo';
import {
    marketProfileOf,
    DEFAULT_MARKET_PROFILE,
} from '@/shared/config/marketProfile/registry';
import { type MarketProfileId } from '@/shared/config/marketProfile/types';

/** 해석된 자산 정보 → 시장 프로필. 없는(미지·레거시) 종목은 기본 프로필로 떨어진다. */
export function marketProfileForAssetInfo(
    assetInfo: AssetInfo | null
): MarketProfileId {
    return assetInfo ? marketProfileOf(assetInfo) : DEFAULT_MARKET_PROFILE;
}

/**
 * Resolves the canonical `MarketProfileId` for a symbol via `getAssetInfo`
 * (DB membership for crypto). Unknown / legacy symbols fall back to
 * `DEFAULT_MARKET_PROFILE` ('us-equity').
 *
 * **Uncached**: `getAssetInfo` has no cross-request cache — every call reads
 * `asset_translations` (and, on a miss, Redis/yahoo/FMP). Hot request paths
 * that run per visitor interaction should use `resolveMarketProfileStatic`
 * instead; this variant stays for callers that must see a just-written row.
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
    return marketProfileForAssetInfo(await getAssetInfo(symbol));
}
