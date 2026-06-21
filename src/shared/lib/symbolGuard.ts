import { VALID_TICKER_RE } from '@/shared/config/market';

/**
 * Returns `true` when a ticker cannot be resolved because both FMP and the
 * crypto_assets DB are simultaneously degraded AND the symbol does not match
 * the conventional U.S. ticker shape (`VALID_TICKER_RE`).
 *
 * **Why this guard exists**
 * - All `[symbol]` route pages call `getAssetInfoResilient` (or an equivalent
 *   resilient resolver) which returns `{ degraded: true }` when FMP is down.
 * - For symbols that *start with a digit* (e.g. `1INCHUSD`), the U.S.-ticker
 *   regex never matches. If both data sources are unavailable there is no way
 *   to confirm the symbol exists, so returning a 404 is more honest than
 *   serving a degraded 200 (noindex) for an unresolvable URL.
 * - Symbols that DO match `VALID_TICKER_RE` (e.g. `AAPL`) represent real U.S.
 *   equities that are only *transiently* unresolvable; the existing
 *   degrade-200 + noindex behaviour is correct for them and must be preserved.
 *
 * **Usage**
 * ```ts
 * const { assetInfo, degraded } = await getAssetInfoResilient(ticker);
 * if (isUnresolvableDegraded(ticker, degraded)) notFound();
 * ```
 */
export function isUnresolvableDegraded(
    ticker: string,
    degraded: boolean
): boolean {
    return degraded && !VALID_TICKER_RE.test(ticker);
}
