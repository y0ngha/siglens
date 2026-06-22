import { getDescriptor } from '@/shared/config/marketProfile';
import type { MarketProfileId } from '@/shared/config/marketProfile';
import { dynamicDecimals } from '@/shared/lib/priceFormat';

/**
 * Resolve the number of price decimals for a market profile.
 *
 * fixed/integer descriptors are static; dynamic (crypto) derives significant
 * digits from the latest close magnitude so sub-cent tokens aren't flattened.
 *
 * Extracted from StockChart's inline function so it can be unit-tested in
 * isolation and reused by other chart components without coupling to the React
 * component graph.
 *
 * @param marketProfile - The market profile id (e.g. 'us-equity', 'crypto').
 * @param lastClose - The most recent close price; used only for 'dynamic-by-magnitude'
 *   precision. Defaults to 1 (returns 2 decimals) when undefined.
 */
export function resolvePriceDecimals(
    marketProfile: MarketProfileId,
    lastClose: number | undefined
): number {
    const precision = getDescriptor(marketProfile).priceFormat.precision;
    if (precision.kind === 'fixed') return precision.digits;
    if (precision.kind === 'integer') return 0;
    return dynamicDecimals(lastClose ?? 1);
}
