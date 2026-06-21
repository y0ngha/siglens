import { notFound } from 'next/navigation';
import { getAssetInfo } from '@/entities/ticker/lib/getAssetInfo';
import {
    getDescriptor,
    marketProfileOf,
    DEFAULT_MARKET_PROFILE,
} from '@/shared/config/marketProfile';

/**
 * Guard: resolves the market profile for `symbol` and calls `notFound()` if
 * the resolved profile's tab whitelist does not include `tab`.
 *
 * Consolidates the four equity-only tab guards (fundamental, financials,
 * congress, options) into a single call. Each page passes its own tab key:
 *
 * ```ts
 * await assertTabAllowedForSymbol(upper, 'fundamental');
 * ```
 *
 * Behavior is identical to the inline guard it replaces:
 *   - crypto symbols → profile 'crypto' → tabs does not include equity-only
 *     keys → notFound()
 *   - equity symbols / unknown symbols (falls back to 'us-equity') → tab
 *     present → no-op
 */
export async function assertTabAllowedForSymbol(
    symbol: string,
    tab: string
): Promise<void> {
    const assetInfo = await getAssetInfo(symbol);
    const profile = assetInfo
        ? marketProfileOf(assetInfo)
        : DEFAULT_MARKET_PROFILE;
    if (!getDescriptor(profile).tabs.includes(tab)) {
        notFound();
    }
}
