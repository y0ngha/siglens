import { tryGetTickerDatabaseClient } from './db';
import { DrizzleCryptoAssetRepository } from '@/entities/ticker/api';
import type {
    CryptoAssetRecord,
    CryptoAssetRepository,
} from '@/shared/db/types';
import type { TickerSearchResult } from '@/shared/lib/types';

const CRYPTO_SEARCH_LIMIT = 10;

/**
 * Module-level caches for hot-path crypto classification and record lookups.
 * The crypto universe is static (no delists mid-session), so a simple Map is
 * safe here — no TTL needed. The process restarts on deploy, flushing stale entries.
 */
const cryptoSymbolCache = new Map<string, boolean>();
const cryptoAssetCache = new Map<string, CryptoAssetRecord | null>();

function tryGetRepository(): CryptoAssetRepository | null {
    const client = tryGetTickerDatabaseClient();
    if (!client) return null;
    return new DrizzleCryptoAssetRepository(client.db);
}

function recordToSearchResult(r: CryptoAssetRecord): TickerSearchResult {
    return {
        symbol: r.symbol,
        name: r.name,
        exchange: 'CRYPTO',
        exchangeFullName: 'Cryptocurrency',
        ...(r.koreanName ? { koreanName: r.koreanName } : {}),
        marketProfile: 'crypto',
    };
}

/** Authoritative crypto classifier: true iff the symbol exists in crypto_assets. */
export async function isCryptoSymbol(symbol: string): Promise<boolean> {
    const upper = symbol.toUpperCase();
    if (cryptoSymbolCache.has(upper)) return cryptoSymbolCache.get(upper)!;
    const repository = tryGetRepository();
    if (!repository) return false;
    try {
        const result = (await repository.findBySymbol(upper)) !== null;
        cryptoSymbolCache.set(upper, result);
        return result;
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
    if (cryptoAssetCache.has(upper)) return cryptoAssetCache.get(upper)!;
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
    const repository = tryGetRepository();
    if (!repository) return [];
    try {
        const rows = await repository.search(query, CRYPTO_SEARCH_LIMIT);
        return rows.map(recordToSearchResult);
    } catch (e) {
        console.warn('[cryptoAssetStore] search failed', e);
        return [];
    }
}
