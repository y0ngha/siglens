import { tryGetTickerDatabaseClient } from './db';
import { DrizzleCryptoAssetRepository } from '../api';
import type {
    CryptoAssetRecord,
    CryptoAssetRepository,
} from '@/shared/db/types';
import type { TickerSearchResult } from '@/shared/lib/types';

const CRYPTO_SEARCH_LIMIT = 10;

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
    const repository = tryGetRepository();
    if (!repository) return false;
    try {
        return (await repository.findBySymbol(symbol.toUpperCase())) !== null;
    } catch (e) {
        console.warn('[cryptoAssetStore] findBySymbol failed', e);
        return false;
    }
}

/** Fetch a single crypto asset record (name/koreanName/supply) or null. */
export async function getCryptoAsset(
    symbol: string
): Promise<CryptoAssetRecord | null> {
    const repository = tryGetRepository();
    if (!repository) return null;
    try {
        return await repository.findBySymbol(symbol.toUpperCase());
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
