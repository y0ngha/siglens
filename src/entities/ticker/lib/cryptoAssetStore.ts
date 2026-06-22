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

/** Authoritative crypto classifier: true iff the symbol exists in crypto_assets. */
export async function isCryptoSymbol(symbol: string): Promise<boolean> {
    const upper = symbol.toUpperCase();
    if (cryptoSymbolCache.has(upper)) return cryptoSymbolCache.get(upper)!;
    const repository = tryGetRepository();
    if (!repository) {
        // No DB — try FMP-list as last resort so tab guards don't 404 new coins.
        const entry = await fmpCryptoMembership(upper);
        return entry !== null;
    }
    try {
        const result = (await repository.findBySymbol(upper)) !== null;
        if (result) {
            cryptoSymbolCache.set(upper, true);
            return true;
        }
        // DB confirms not a crypto_assets member — check FMP-list freshness fallback
        // for coins added after the last re-seed. Do NOT cache the positive result in
        // cryptoSymbolCache: the FMP-list check has its own 24 h Redis TTL, and the
        // module Map has no expiry — caching true here would keep a "new coin" as
        // crypto-classified beyond the FMP-list TTL if the process stays warm.
        // Negative (not in FMP-list either) IS safe to cache: confirmed-not-crypto.
        const fmpEntry = await fmpCryptoMembership(upper);
        if (fmpEntry !== null) return true;
        cryptoSymbolCache.set(upper, false);
        return false;
    } catch (e) {
        console.warn('[cryptoAssetStore] findBySymbol failed', e);
        return false;
    }
}

/** Fetch a single crypto asset record (name/koreanName/supply) or null. */
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
        cryptoSymbolCache.set(upper, record !== null);
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
