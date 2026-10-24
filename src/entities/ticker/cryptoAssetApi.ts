import { desc, eq, ilike, or, sql } from 'drizzle-orm';
import { fmpGet } from '@/shared/api/fmp/httpClient';
import { escapeLikePattern } from '@/shared/db/likePattern';
import { cryptoAssets } from '@/shared/db/schema';
import type {
    CryptoAssetRecord,
    CryptoAssetRepository,
    SiglensDatabase,
} from '@/shared/db/types';
import {
    mapCryptoListRow,
    type CryptoAssetRow,
    type FmpCryptoListRaw,
} from './lib/fmpCryptoListClient';

/*
 * 크립토 자산 유니버스의 I/O(FMP 목록 조회, `crypto_assets` 테이블 조회).
 *
 * `api.ts`와 따로 둔다. 크립토 판정(`lib/cryptoAssetStore` 등)이 이것을 쓰고 `api.ts`는 크립토
 * 판정을 쓰므로, 한 파일에 두면 런타임 순환이 된다(`src/__tests__/guards/importCycles.test.ts`).
 */

/**
 * DB-side ORDER BY priority buckets for crypto search (lower = ranked first).
 * These ORDINALS mirror the relevance TIERS in `searchRelevance.ts`
 * (EXACT > PREFIX > rest, i.e. its 100 > 70 > 40/10 scores): the DB pre-sort only
 * needs each tier's rank so exact/prefix matches survive the LIMIT cut, while the
 * app-side scorer assigns the actual numeric scores after the fetch. Keep the two
 * systems aligned — if a tier is added to `searchRelevance`, add a bucket here.
 */
const DB_SORT_EXACT = 0;
const DB_SORT_PREFIX = 1;
const DB_SORT_OTHER = 2;

/** Fetch the full FMP cryptocurrency universe and map to crypto_assets rows. */
export async function fetchCryptoAssetList(): Promise<CryptoAssetRow[]> {
    try {
        const raw = await fmpGet<FmpCryptoListRaw[]>('cryptocurrency-list', {});
        return raw
            .map(mapCryptoListRow)
            .filter((r): r is CryptoAssetRow => r !== null);
    } catch (e) {
        // Boundary I/O logging; re-throw so the seed script fails loudly
        // (a silent [] fallback would mask a failed crypto_assets sync).
        console.error(
            '[fetchCryptoAssetList] FMP cryptocurrency-list fetch failed:',
            e
        );
        throw e;
    }
}

/**
 * Drizzle ORM implementation of {@link CryptoAssetRepository} backed by PostgreSQL
 * PostgreSQL. Reads the `crypto_assets` table (written by the seed script).
 *
 * @param db - Drizzle-wrapped database client; obtain via `createDatabaseClient`.
 */
export class DrizzleCryptoAssetRepository implements CryptoAssetRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async findBySymbol(symbol: string): Promise<CryptoAssetRecord | null> {
        const rows = await this.db
            .select()
            .from(cryptoAssets)
            .where(eq(cryptoAssets.symbol, symbol))
            .limit(1);
        return rows[0] ?? null;
    }

    async search(query: string, limit: number): Promise<CryptoAssetRecord[]> {
        const literal = escapeLikePattern(query);
        const like = `%${literal}%`;
        const exactOrPrefix = `${literal}%`;
        return this.db
            .select()
            .from(cryptoAssets)
            .where(
                or(
                    ilike(cryptoAssets.symbol, like),
                    ilike(cryptoAssets.name, like),
                    ilike(cryptoAssets.koreanName, like)
                )
            )
            .orderBy(
                // Mirror searchRelevance's scored fields (koreanName/symbol/name) so
                // exact/prefix matches in ANY of them are fetched within the limit
                // before app-side re-ranking.
                sql`CASE
                  WHEN lower(${cryptoAssets.koreanName}) = lower(${query}) OR lower(${cryptoAssets.symbol}) = lower(${query}) OR lower(${cryptoAssets.name}) = lower(${query}) THEN ${DB_SORT_EXACT}
                  WHEN ${cryptoAssets.koreanName} ILIKE ${exactOrPrefix} OR ${cryptoAssets.symbol} ILIKE ${exactOrPrefix} OR ${cryptoAssets.name} ILIKE ${exactOrPrefix} THEN ${DB_SORT_PREFIX}
                  ELSE ${DB_SORT_OTHER} END`,
                desc(cryptoAssets.circulatingSupply)
            )
            .limit(limit);
    }
}
