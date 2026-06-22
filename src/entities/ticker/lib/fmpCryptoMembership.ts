import 'server-only';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { SECONDS_PER_DAY } from '@/shared/config/time';
import { fetchCryptoAssetList } from '../api';
import type { CryptoAssetRow } from './fmpCryptoListClient';

/** Serializable form stored in Redis (Map is not JSON-serializable). */
type FmpCryptoListRecord = Record<string, { name: string }>;

/**
 * Fetch and cache the full FMP cryptocurrency-list as an upper-symbol-keyed Map.
 *
 * Why Redis + 24 h TTL rather than a module-level Map:
 * The FMP list (~4785 entries) is large and changes slowly. A module-level Map
 * would only survive a single server instance and would be re-fetched on every
 * cold start (Vercel serverless). Redis gives cross-instance sharing and a
 * deterministic 24 h freshness window — matching the crypto_assets seed cadence.
 *
 * Why store as a plain object (Record) rather than a Map in Redis:
 * Upstash serializes values with JSON.stringify; Map instances are not
 * JSON-serializable (they serialize to `{}`). We store as a Record and convert
 * to Map on read.
 *
 * ISR cold-gen safety: DYNAMIC_SERVER_USAGE is thrown by `connection()`,
 * `cookies()`, and `headers()` — NOT by no-store `fetch` calls. Both the
 * Upstash REST client and `fmpGet` use `fetch` without those dynamic APIs, so
 * they are safe inside `unstable_cache`. This mirrors the existing `getAssetInfo`
 * chain, which already calls `fmpGet` with `cache: 'no-store'` (via
 * `searchBySymbol`) inside the same `unstable_cache` wrapper — `getAssetInfoStatic`
 * JSDoc explicitly confirms: "cache/DB/FMP/koreanNameStore에 cookies()/headers()/
 * connection() 없음 → unstable_cache 래핑 안전".
 *
 * Infra/FMP failure → returns empty Map (caller degrades to null, resolution
 * falls through to stock path — no 500).
 *
 * @internal Exported for tests only; production callers use `fmpCryptoMembership`.
 */
export async function getFmpCryptoListMap(): Promise<
    Map<string, { name: string }>
> {
    try {
        const record = await getOrSetCache<FmpCryptoListRecord>(
            'crypto:fmp-list',
            SECONDS_PER_DAY,
            async () => {
                const rows = await fetchCryptoAssetList();
                return Object.fromEntries(
                    rows.map((r: CryptoAssetRow) => [
                        r.symbol.toUpperCase(),
                        { name: r.name },
                    ])
                );
            }
        );
        return new Map(Object.entries(record));
    } catch (e) {
        console.warn(
            '[fmpCryptoMembership] getFmpCryptoListMap failed, degrading to empty',
            e
        );
        return new Map();
    }
}

/**
 * Check FMP's cryptocurrency-list for the given symbol (uppercase-normalized).
 *
 * Returns the list entry `{ name }` if the symbol is present,
 * or `null` if absent or on any infra/FMP failure (degrade, never throw).
 *
 * This is the freshness fallback for `getAssetInfo`: when `crypto_assets` DB
 * misses (symbol not yet re-seeded), this check lets new coins resolve as crypto
 * within the 24 h cache TTL instead of 404-ing.
 */
export async function fmpCryptoMembership(
    symbol: string
): Promise<{ name: string } | null> {
    // getFmpCryptoListMap catches all infra/FMP failures internally and returns
    // an empty Map — it never throws. map.get() cannot throw. The outer try/catch
    // would be unreachable and is intentionally omitted.
    const map = await getFmpCryptoListMap();
    return map.get(symbol.toUpperCase()) ?? null;
}
