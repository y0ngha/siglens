import { tryGetTickerDatabaseClient } from './db';
import { DrizzleCryptoAssetRepository } from '../api';
import { fmpCryptoMembership } from './fmpCryptoMembership';
import type {
    CryptoAssetRecord,
    CryptoAssetRepository,
} from '@/shared/db/types';
import type { TickerSearchResult } from '@/shared/lib/types';

const CRYPTO_SEARCH_LIMIT = 10;

const CRYPTO_EXCHANGE_CODE = 'CRYPTO';
const CRYPTO_EXCHANGE_FULL_NAME = 'Cryptocurrency';

/**
 * Module-level caches for hot-path crypto classification and record lookups.
 * The crypto universe is static (no delists mid-session), so a simple Map is
 * safe here — no TTL needed. The process restarts on deploy, flushing stale entries.
 *
 * `cryptoSymbolCache` holds the AUTHORITATIVE classification: a symbol is set
 * only after the full check (DB OR FMP-list) has been performed. This prevents
 * cache pollution: if `getCryptoAsset` (DB-only) misses and sets `false`, a
 * subsequent `isCryptoSymbol` would never consult the FMP-list fallback, causing
 * new un-seeded coins to be misclassified as non-crypto.
 *
 * - `true`  → confirmed crypto (DB hit OR FMP-list hit)
 * - `false` → confirmed non-crypto (DB miss AND FMP-list miss)
 *
 * Caching FMP-positive `true` is safe: asset class is effectively immutable
 * within a process lifetime (crypto never becomes a stock). Only after BOTH
 * DB and FMP-list miss is the symbol definitively classified as non-crypto.
 *
 * `cryptoSearchCache` is keyed by the normalized query (lowercased + trimmed)
 * and stores the mapped TickerSearchResult array. Autocomplete fires on every
 * keypress, so avoiding repeated DB round-trips for the same prefix is worth
 * the small memory cost on a static universe.
 */
const cryptoSymbolCache = new Map<string, boolean>();
const cryptoAssetCache = new Map<string, CryptoAssetRecord | null>();
const cryptoSearchCache = new Map<string, TickerSearchResult[]>();

function tryGetRepository(): CryptoAssetRepository | null {
    const client = tryGetTickerDatabaseClient();
    if (!client) return null;
    return new DrizzleCryptoAssetRepository(client.db);
}

function recordToSearchResult(r: CryptoAssetRecord): TickerSearchResult {
    return {
        symbol: r.symbol,
        name: r.name,
        exchange: CRYPTO_EXCHANGE_CODE,
        exchangeFullName: CRYPTO_EXCHANGE_FULL_NAME,
        ...(r.koreanName ? { koreanName: r.koreanName } : {}),
        marketProfile: 'crypto',
    };
}

/**
 * Authoritative crypto classifier: true iff the symbol is in crypto_assets OR FMP-list.
 *
 * Cache contract: `cryptoSymbolCache` is only written AFTER the full check
 * (DB + optional FMP-list fallback). This prevents the following pollution
 * scenario: `getCryptoAsset` (DB-only) misses and writes `false` → a later
 * `isCryptoSymbol` hits the cache and returns `false` without ever consulting
 * the FMP-list → an un-seeded but valid crypto coin is misclassified.
 *
 * `true`  is cached whenever DB OR FMP-list confirms the symbol is crypto.
 * `false` is cached ONLY after BOTH DB miss AND FMP-list miss.
 */
export async function isCryptoSymbol(symbol: string): Promise<boolean> {
    const upper = symbol.toUpperCase();
    if (cryptoSymbolCache.has(upper)) return cryptoSymbolCache.get(upper)!;
    const repository = tryGetRepository();
    if (!repository) {
        // No DB — try FMP-list as last resort so tab guards don't 404 new coins.
        const isCrypto = (await fmpCryptoMembership(upper)) !== null;
        cryptoSymbolCache.set(upper, isCrypto);
        return isCrypto;
    }
    try {
        const dbHit = (await repository.findBySymbol(upper)) !== null;
        if (dbHit) {
            cryptoSymbolCache.set(upper, true);
            return true;
        }
        // DB miss — consult FMP-list for un-seeded coins added after last re-seed.
        // Cache the result regardless: `true` is safe (asset class is immutable),
        // and `false` only lands here after both DB and FMP-list confirm non-crypto.
        const isCrypto = (await fmpCryptoMembership(upper)) !== null;
        cryptoSymbolCache.set(upper, isCrypto);
        return isCrypto;
    } catch (e) {
        console.warn('[cryptoAssetStore] findBySymbol failed', e);
        return false;
    }
}

/**
 * Fetch a single crypto asset record (name/koreanName/supply) or null.
 *
 * Cache contract: this function only consults the DB (no FMP-list fallback),
 * so it must NOT write `false` into `cryptoSymbolCache` on a DB miss — doing
 * so would poison the cache for `isCryptoSymbol`, which also checks the
 * FMP-list before classifying a symbol as non-crypto. On DB HIT we write
 * `true` into `cryptoSymbolCache` as a performance prime (avoids a redundant
 * `isCryptoSymbol` DB round-trip for the same symbol). On DB MISS we leave
 * `cryptoSymbolCache` untouched; `isCryptoSymbol` will fill it correctly after
 * its own full check (DB + FMP-list).
 */
export async function getCryptoAsset(
    symbol: string
): Promise<CryptoAssetRecord | null> {
    const upper = symbol.toUpperCase();
    // `cryptoAssetCache` stores `null` as a legitimate value (= "confirmed not
    // a crypto asset"), so `.get(upper)!` would unsafely assert non-null on a
    // stored null. Use an explicit `undefined` check instead — `has` + `get`
    // are equivalent but require two Map lookups; a single `get` and an
    // `!== undefined` check is both correct and cheaper.
    const cached = cryptoAssetCache.get(upper);
    if (cached !== undefined) return cached;
    const repository = tryGetRepository();
    if (!repository) return null;
    try {
        const record = await repository.findBySymbol(upper);
        cryptoAssetCache.set(upper, record);
        if (record !== null) {
            // On a DB miss we deliberately leave cryptoSymbolCache untouched, so
            // isCryptoSymbol still checks the FMP-list before caching `false`.
            cryptoSymbolCache.set(upper, true);
        }
        return record;
    } catch (e) {
        console.warn('[cryptoAssetStore] getCryptoAsset failed', e);
        return null;
    }
}

/** Search crypto assets by symbol/name; ordered by liquidity, capped. */
export async function searchCryptoAssets(
    query: string
): Promise<TickerSearchResult[]> {
    const normalizedQuery = query.toLowerCase().trim();
    if (cryptoSearchCache.has(normalizedQuery))
        return cryptoSearchCache.get(normalizedQuery)!;
    const repository = tryGetRepository();
    if (!repository) return [];
    try {
        const rows = await repository.search(
            normalizedQuery,
            CRYPTO_SEARCH_LIMIT
        );
        const results = rows.map(recordToSearchResult);
        cryptoSearchCache.set(normalizedQuery, results);
        return results;
    } catch (e) {
        console.warn('[cryptoAssetStore] search failed', e);
        return [];
    }
}
