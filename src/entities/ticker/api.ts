import type { KoreanTickerEntry } from '@/shared/lib/types';
import { fmpGet } from '@/shared/api/fmp/httpClient';
import {
    mapCryptoListRow,
    type CryptoAssetRow,
    type FmpCryptoListRaw,
} from './lib/fmpCryptoListClient';
import { and, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import type { KrTickerListingRow } from '@/shared/lib/krTickerReconcile';
import { NEON_TRANSIENT_RETRY } from '@/shared/db/isNeonTransientError';
import {
    assetTranslations,
    cryptoAssets,
    koreanTickers,
    profileDescriptionTranslations,
} from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import type {
    AssetTranslationRecord,
    AssetTranslationRepository,
    CryptoAssetRecord,
    CryptoAssetRepository,
    KoreanTickerRepository,
    ProfileDescriptionTranslationRecord,
    ProfileDescriptionTranslationRepository,
} from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import { isCryptoSymbolStatic } from './lib/isCryptoSymbolStatic';
import {
    getDescriptor,
    isKrEquitySymbol,
    DEFAULT_MARKET_PROFILE,
    type TabKey,
} from '@/shared/config/marketProfile';

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

/**
 * 한 INSERT 문에 담을 최대 행 수. 전 종목 동기화는 2,500행대라 한 번에 보내면 Neon HTTP
 * 페이로드 한도에 걸린다. 기존 시드 스크립트가 쓰던 값과 같다.
 */
const KOREAN_TICKER_UPSERT_BATCH_SIZE = 500;

const koreanTickerColumns = {
    symbol: koreanTickers.symbol,
    name: koreanTickers.name,
    koreanName: koreanTickers.koreanName,
    exchange: koreanTickers.exchange,
    exchangeFullName: koreanTickers.exchangeFullName,
};

type KoreanTickerRow = Pick<
    KoreanTickerEntry,
    'symbol' | 'name' | 'koreanName' | 'exchange' | 'exchangeFullName'
>;

const assetTranslationColumns = {
    symbol: assetTranslations.symbol,
    name: assetTranslations.name,
    koreanName: assetTranslations.koreanName,
    fmpSymbol: assetTranslations.fmpSymbol,
};

/**
 * Drizzle ORM implementation of {@link KoreanTickerRepository} backed by Neon
 * PostgreSQL. Reads/writes the `korean_tickers` table.
 *
 * @param db - Drizzle-wrapped Neon database client; obtain via `createDatabaseClient`.
 */
export class DrizzleKoreanTickerRepository implements KoreanTickerRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /**
     * 상장 중인 행만 반환한다 — 이 결과가 한글명 검색 후보 전체다. 상폐 종목이 섞이면
     * 자동완성에 뜨고 클릭하면 시세가 없는 죽은 페이지로 간다.
     */
    async findAll(): Promise<KoreanTickerEntry[]> {
        return this.db
            .select(koreanTickerColumns)
            .from(koreanTickers)
            .where(isNull(koreanTickers.delistedAt));
    }

    async findBySymbols(
        symbols: readonly string[]
    ): Promise<KoreanTickerEntry[]> {
        if (symbols.length === 0) return [];

        return this.db
            .select(koreanTickerColumns)
            .from(koreanTickers)
            .where(inArray(koreanTickers.symbol, [...symbols]));
    }

    async upsertMany(entries: readonly KoreanTickerEntry[]): Promise<void> {
        for (
            let i = 0;
            i < entries.length;
            i += KOREAN_TICKER_UPSERT_BATCH_SIZE
        ) {
            await this.upsertBatch(
                entries.slice(i, i + KOREAN_TICKER_UPSERT_BATCH_SIZE)
            );
        }
    }

    private async upsertBatch(
        entries: readonly KoreanTickerEntry[]
    ): Promise<void> {
        if (entries.length === 0) return;

        await withRetry(
            () =>
                this.db
                    .insert(koreanTickers)
                    .values(entries.map(toKoreanTickerRow))
                    .onConflictDoUpdate({
                        target: koreanTickers.symbol,
                        // Drizzle's onConflictDoUpdate does not trigger schema-level
                        // $onUpdateFn hooks; set updated_at explicitly. We use sql`now()`
                        // (DB-server clock) rather than new Date() (app-server clock) so
                        // timestamps stay monotonic across concurrent app instances
                        // writing to the same row.
                        set: {
                            name: sql`excluded.name`,
                            koreanName: sql`excluded.korean_name`,
                            exchange: sql`excluded.exchange`,
                            exchangeFullName: sql`excluded.exchange_full_name`,
                            updatedAt: sql`now()`,
                        },
                    }),
            NEON_TRANSIENT_RETRY
        );
    }

    async findAllListingStatuses(): Promise<KrTickerListingRow[]> {
        return this.db
            .select({
                symbol: koreanTickers.symbol,
                delistedAt: koreanTickers.delistedAt,
            })
            .from(koreanTickers);
    }

    async markDelisted(symbols: readonly string[]): Promise<void> {
        if (symbols.length === 0) return;

        // `isNull` 조건이 재실행을 멱등하게 만든다 — 이미 표시된 행의 타임스탬프를
        // 다시 밀면 "언제부터 상폐였나"를 잃는다.
        await withRetry(
            () =>
                this.db
                    .update(koreanTickers)
                    .set({ delistedAt: sql`now()` })
                    .where(
                        and(
                            inArray(koreanTickers.symbol, [...symbols]),
                            isNull(koreanTickers.delistedAt)
                        )
                    ),
            NEON_TRANSIENT_RETRY
        );
    }

    async markRelisted(symbols: readonly string[]): Promise<void> {
        if (symbols.length === 0) return;

        await withRetry(
            () =>
                this.db
                    .update(koreanTickers)
                    .set({ delistedAt: null })
                    .where(inArray(koreanTickers.symbol, [...symbols])),
            NEON_TRANSIENT_RETRY
        );
    }
}

/**
 * Drizzle ORM implementation of {@link AssetTranslationRepository} backed by
 * Neon PostgreSQL. Reads/writes the `asset_translations` table.
 *
 * @param db - Drizzle-wrapped Neon database client; obtain via `createDatabaseClient`.
 */
export class DrizzleAssetTranslationRepository implements AssetTranslationRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async findBySymbol(symbol: string): Promise<AssetTranslationRecord | null> {
        const [row] = await this.db
            .select(assetTranslationColumns)
            .from(assetTranslations)
            .where(eq(assetTranslations.symbol, symbol))
            .limit(1);

        return row ?? null;
    }

    async upsert(record: AssetTranslationRecord): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .insert(assetTranslations)
                    .values(record)
                    .onConflictDoUpdate({
                        target: assetTranslations.symbol,
                        // Drizzle's onConflictDoUpdate does not trigger schema-level
                        // $onUpdateFn hooks; set updated_at explicitly. We use sql`now()`
                        // (DB-server clock) rather than new Date() (app-server clock) so
                        // timestamps stay monotonic across concurrent app instances
                        // writing to the same row.
                        set: {
                            name: sql`excluded.name`,
                            koreanName: sql`excluded.korean_name`,
                            fmpSymbol: sql`excluded.fmp_symbol`,
                            updatedAt: sql`now()`,
                        },
                    }),
            NEON_TRANSIENT_RETRY
        );
    }
}

/**
 * Drizzle ORM implementation of {@link ProfileDescriptionTranslationRepository}.
 * Reads/writes the `profile_description_translations` table.
 *
 * @param db - Drizzle-wrapped Neon database client; obtain via `createDatabaseClient`.
 */
export class DrizzleProfileDescriptionTranslationRepository implements ProfileDescriptionTranslationRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async findBySymbol(
        symbol: string
    ): Promise<ProfileDescriptionTranslationRecord | null> {
        const [row] = await this.db
            .select({
                symbol: profileDescriptionTranslations.symbol,
                descriptionKo: profileDescriptionTranslations.descriptionKo,
            })
            .from(profileDescriptionTranslations)
            .where(eq(profileDescriptionTranslations.symbol, symbol))
            .limit(1);

        return row ?? null;
    }

    async upsert(record: ProfileDescriptionTranslationRecord): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .insert(profileDescriptionTranslations)
                    .values(record)
                    .onConflictDoUpdate({
                        target: profileDescriptionTranslations.symbol,
                        set: {
                            descriptionKo: sql`excluded.description_ko`,
                            updatedAt: sql`now()`,
                        },
                    }),
            NEON_TRANSIENT_RETRY
        );
    }
}

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
 * ISR cold-gen-safe tab guard predicate: returns `true` if `tab` is allowed
 * for the given `symbol`'s market profile.
 *
 * Uses `isCryptoSymbolStatic` (Next.js `unstable_cache`-wrapped Neon DB read)
 * instead of raw `isCryptoSymbol` so that ISR cold-gen does not encounter a
 * no-store fetch that throws `DYNAMIC_SERVER_USAGE`. The page-level tab guards
 * for options/financials/fundamental/congress run BEFORE `getAssetInfoResilient`,
 * which means without this wrapper they would be the first uncached DB read on
 * a fresh ISR render, causing a 500.
 *
 * Hot paths (getAssetInfo, search) continue to use `isCryptoSymbol` directly —
 * those callers are not wrapped here and are unaffected by this change.
 *
 * 한국 상장 종목은 심볼 형상(`005930.KS`)만으로 판정되므로 DB 조회 이전에 분기한다 —
 * `unstable_cache` 왕복이 통째로 생략된다. 이 분기가 없으면 kr-equity 심볼이
 * `DEFAULT_MARKET_PROFILE`(us-equity)로 떨어져 국내에 존재하지 않는 options/congress
 * 탭이 200으로 열린다.
 *
 * The `notFound()` side-effect intentionally lives in the calling page (app layer),
 * not here — this function is a pure predicate.
 *
 * ```ts
 * // In a page component:
 * if (!(await isTabAllowedForSymbol(upper, 'fundamental'))) notFound();
 * ```
 */
export async function isTabAllowedForSymbol(
    symbol: string,
    tab: TabKey
): Promise<boolean> {
    // 한국 종목은 형상만으로 확정되므로 먼저 반환한다 — DB를 때리는
    // `isCryptoSymbolStatic` 호출 자체를 건너뛴다.
    if (isKrEquitySymbol(symbol)) {
        return getDescriptor('kr-equity').tabs.includes(tab);
    }

    const profile = (await isCryptoSymbolStatic(symbol))
        ? 'crypto'
        : DEFAULT_MARKET_PROFILE;
    return getDescriptor(profile).tabs.includes(tab);
}

/** Select DB row fields explicitly so future KoreanTickerEntry fields are not persisted accidentally. */
function toKoreanTickerRow(entry: KoreanTickerEntry): KoreanTickerRow {
    return {
        symbol: entry.symbol,
        name: entry.name,
        koreanName: entry.koreanName,
        exchange: entry.exchange,
        exchangeFullName: entry.exchangeFullName,
    };
}

/**
 * Drizzle ORM implementation of {@link CryptoAssetRepository} backed by Neon
 * PostgreSQL. Reads the `crypto_assets` table (written by the seed script).
 *
 * @param db - Drizzle-wrapped Neon database client; obtain via `createDatabaseClient`.
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
        const like = `%${query}%`;
        const exactOrPrefix = `${query}%`;
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
