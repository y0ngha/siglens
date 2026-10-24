import type {
    KoreanTickerEntry,
    KoreanTickerUpsertEntry,
} from '@/shared/lib/types';
import {
    and,
    desc,
    eq,
    ilike,
    inArray,
    isNotNull,
    isNull,
    like,
    notLike,
    or,
    sql,
} from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import {
    assetTranslations,
    koreanTickers,
    profileDescriptionTranslations,
} from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import type {
    AssetTranslationRecord,
    AssetTranslationRepository,
    KoreanTickerRepository,
    KoreanTickerUpsertOptions,
    KrTickerListingRow,
    ProfileDescriptionTranslationRecord,
    ProfileDescriptionTranslationRepository,
} from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import { isCryptoSymbolStatic } from './lib/isCryptoSymbolStatic';
import {
    getDescriptor,
    isKrEquitySymbol,
    DEFAULT_MARKET_PROFILE,
} from '@/shared/config/marketProfile/registry';
import { type TabKey } from '@/shared/config/marketProfile/types';

/**
 * `korean_tickers`에 대한 한 INSERT/UPDATE 문에 담을 최대 행 수. 전 종목 동기화는
 * 2,500행대라 한 번에 보내면 한 쿼리의 페이로드·바인드 파라미터(최대 65,535개) 한도에
 * 걸린다(청크 크기 500은 과거 Neon HTTP 페이로드 한도에서 정한 값이다). `upsertMany`(INSERT),
 * `markRelisted`(대량 재상장 UPDATE), `markDelisted`(대량 상폐 UPDATE) 세 곳의 청크
 * 크기로 재사용한다.
 * `scripts/seed-kr-listed-names.ts`의 `UPSERT_BATCH_SIZE`와 같은 한도를 인코딩한
 * 값이다 — 하나를 바꾸면 다른 쪽도 함께 확인해야 한다.
 */
export const KOREAN_TICKER_UPSERT_BATCH_SIZE = 500;

/**
 * 국내 종목 심볼 접미사. `isKrEquitySymbol`(`KR_SYMBOL_RE`)과 같은 집합이어야 한다 —
 * 일치는 `api.test.ts`가 고정한다.
 */
export const KR_SYMBOL_LIKE_PATTERNS = ['%.KS', '%.KQ'] as const;

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
> & { listedShares: number | null };

const assetTranslationColumns = {
    symbol: assetTranslations.symbol,
    name: assetTranslations.name,
    koreanName: assetTranslations.koreanName,
    fmpSymbol: assetTranslations.fmpSymbol,
};

/**
 * Drizzle ORM implementation of {@link KoreanTickerRepository} backed by PostgreSQL
 * PostgreSQL. Reads/writes the `korean_tickers` table.
 *
 * @param db - Drizzle-wrapped database client; obtain via `createDatabaseClient`.
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

    async upsertMany(
        entries: readonly KoreanTickerUpsertEntry[],
        options?: KoreanTickerUpsertOptions
    ): Promise<void> {
        for (
            let i = 0;
            i < entries.length;
            i += KOREAN_TICKER_UPSERT_BATCH_SIZE
        ) {
            // 청크는 쿼리 페이로드 한도 때문에 나눈 것이고, DB 연결 하나를 한꺼번에 두드리지
            // 않도록 의도적으로 직렬 실행한다.
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            await this.upsertBatch(
                entries.slice(i, i + KOREAN_TICKER_UPSERT_BATCH_SIZE),
                options
            );
        }
    }

    private async upsertBatch(
        entries: readonly KoreanTickerUpsertEntry[],
        options?: KoreanTickerUpsertOptions
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
                        //
                        // `name`은 `preserveExistingName`이 켜졌을 때만 뺀다 — 그 사유는
                        // `KoreanTickerUpsertOptions` JSDoc(shared/db/types.ts) 참조. INSERT
                        // 쪽 `values()`에는 이 옵션이 관여하지 않으므로 신규 행은 항상
                        // placeholder라도 name을 받는다(placeholder가 null보다는 낫다).
                        set: {
                            ...(options?.preserveExistingName
                                ? {}
                                : { name: sql`excluded.name` }),
                            koreanName: sql`excluded.korean_name`,
                            exchange: sql`excluded.exchange`,
                            exchangeFullName: sql`excluded.exchange_full_name`,
                            // 상장주식수는 한국 상장 동기화만 채운다 — 번역 경로·보충을 못 받은 날의 null이 저장된 값을
                            // 지우지 않게 새 값이 있을 때만 바꾼다.
                            listedShares: sql`coalesce(excluded.listed_shares, ${koreanTickers.listedShares})`,
                            updatedAt: sql`now()`,
                        },
                    }),
            DB_TRANSIENT_RETRY
        );
    }

    /**
     * **국내 상장 종목 행만 반환한다.**
     *
     * `korean_tickers`는 이름이 무색하게 미국·한국 종목을 함께 담는 이중언어 이름
     * 저장소다(2026-08 프로덕션 실측: 32,951행 중 국내는 2,595행). 이 결과는
     * `planKrTickerReconcile`의 "현재 상장 중" 집합이 되는데, 대조 대상인
     * 공공데이터포털 응답은 **KRX만** 담는다. 전량을 넘기면 미국 종목 3만여 건이
     * 매일 "사라진 종목"으로 잡혀, 소실 상한 가드가 매일 걸리고 상폐 처리는 영원히
     * 일어나지 않는다 — 가드가 파국은 막지만 기능이 통째로 죽는다.
     *
     * 접미사로 거르는 이유는 `isKrEquitySymbol`과 같다: 국내 심볼은 canonical 심볼에
     * 거래소 접미사가 박혀 있어 형상만으로 판정이 끝난다.
     */
    async findAllListingStatuses(): Promise<KrTickerListingRow[]> {
        return this.db
            .select({
                symbol: koreanTickers.symbol,
                delistedAt: koreanTickers.delistedAt,
            })
            .from(koreanTickers)
            .where(
                or(
                    ...KR_SYMBOL_LIKE_PATTERNS.map(pattern =>
                        like(koreanTickers.symbol, pattern)
                    )
                )
            );
    }

    /**
     * 국내 종목이 아닌 행 전부. `findAllListingStatuses`의 접미사 조건을 뒤집은 것이라
     * 두 조회가 서로 겹치지 않는다 — 국내 이름은 KRX cron이, 그 밖은 이름 재대조가 맡는다.
     */
    async findAllNonKr(): Promise<KoreanTickerEntry[]> {
        return this.db
            .select(koreanTickerColumns)
            .from(koreanTickers)
            .where(
                and(
                    ...KR_SYMBOL_LIKE_PATTERNS.map(pattern =>
                        notLike(koreanTickers.symbol, pattern)
                    )
                )
            );
    }

    async markDelisted(symbols: readonly string[]): Promise<void> {
        // 현재 유일한 호출부(`syncKrListedTickers`)는 대량 상폐 가드가 25개로 묶어
        // 두므로 지금은 청크가 한 번에 끝난다. 그래도 `markRelisted`와 같은 크기로
        // 맞춰 둔다 — 가드가 완화되거나 새 호출부가 생기는 순간 같은 쿼리
        // 페이로드 한도에 걸리고, 그때는 이 자리가 아니라 호출부를 보게 된다.
        // (`--force-delist`는 시드 스크립트 자체의 UPDATE만 푼다 — 그쪽 주석 참조.)
        for (
            let i = 0;
            i < symbols.length;
            i += KOREAN_TICKER_UPSERT_BATCH_SIZE
        ) {
            // 청크 직렬 실행은 의도다(`upsertMany`와 같은 이유).
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            await this.markDelistedBatch(
                symbols.slice(i, i + KOREAN_TICKER_UPSERT_BATCH_SIZE)
            );
        }
    }

    private async markDelistedBatch(symbols: readonly string[]): Promise<void> {
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
            DB_TRANSIENT_RETRY
        );
    }

    async markRelisted(symbols: readonly string[]): Promise<void> {
        // `upsertMany`와 같은 이유로 청크를 나눈다 — 피드 장애가 며칠 이어졌다 복구되면
        // 재상장 심볼이 한 번에 수백~수천 개 몰릴 수 있고, 그걸 IN (...) 하나에 담으면
        // 같은 쿼리 페이로드 한도에 걸린다.
        for (
            let i = 0;
            i < symbols.length;
            i += KOREAN_TICKER_UPSERT_BATCH_SIZE
        ) {
            // 청크 직렬 실행은 의도다(`upsertMany`와 같은 이유).
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            await this.markRelistedBatch(
                symbols.slice(i, i + KOREAN_TICKER_UPSERT_BATCH_SIZE)
            );
        }
    }

    private async markRelistedBatch(symbols: readonly string[]): Promise<void> {
        if (symbols.length === 0) return;

        await withRetry(
            () =>
                this.db
                    .update(koreanTickers)
                    .set({ delistedAt: null })
                    .where(inArray(koreanTickers.symbol, [...symbols])),
            DB_TRANSIENT_RETRY
        );
    }
}

/**
 * Drizzle ORM implementation of {@link AssetTranslationRepository} backed by
 * PostgreSQL. Reads/writes the `asset_translations` table.
 *
 * @param db - Drizzle-wrapped database client; obtain via `createDatabaseClient`.
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

    async findAll(): Promise<AssetTranslationRecord[]> {
        return this.db.select(assetTranslationColumns).from(assetTranslations);
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
            DB_TRANSIENT_RETRY
        );
    }
}

/**
 * Drizzle ORM implementation of {@link ProfileDescriptionTranslationRepository}.
 * Reads/writes the `profile_description_translations` table.
 *
 * @param db - Drizzle-wrapped database client; obtain via `createDatabaseClient`.
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
            DB_TRANSIENT_RETRY
        );
    }

    async deleteBySymbols(symbols: readonly string[]): Promise<void> {
        // 이름 재대조는 하루 최대 `RENAME_BATCH_MAX`개만 지우지만, 다른 호출부가 생겨도
        // 같은 쿼리 페이로드 한도에 걸리지 않도록 `korean_tickers`와 같은 크기로 쪼갠다.
        for (
            let i = 0;
            i < symbols.length;
            i += KOREAN_TICKER_UPSERT_BATCH_SIZE
        ) {
            const chunk = symbols.slice(i, i + KOREAN_TICKER_UPSERT_BATCH_SIZE);
            // 청크 직렬 실행은 의도다(`upsertMany`와 같은 이유).
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            await withRetry(
                () =>
                    this.db
                        .delete(profileDescriptionTranslations)
                        .where(
                            inArray(profileDescriptionTranslations.symbol, [
                                ...chunk,
                            ])
                        ),
                DB_TRANSIENT_RETRY
            );
        }
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

/**
 * 한국 종목의 KRX 상장주식수(`korean_tickers.listed_shares`, `kr-tickers` cron이 채운다).
 * 상장 중인 행에 값이 있을 때만 숫자, 아니면 null(주식수 모름 — 호출부가 프로바이더 값으로 폴백한다).
 * 일시 DB 오류는 재시도하고, 그래도 실패하면 던진다(호출부가 격리한다).
 */
export async function findKrListedShares(
    symbol: string,
    db: SiglensDatabase
): Promise<number | null> {
    const rows = await withRetry(
        () =>
            db
                .select({ listedShares: koreanTickers.listedShares })
                .from(koreanTickers)
                .where(
                    and(
                        eq(koreanTickers.symbol, symbol),
                        isNull(koreanTickers.delistedAt),
                        isNotNull(koreanTickers.listedShares)
                    )
                )
                .limit(1),
        DB_TRANSIENT_RETRY
    );
    return rows[0]?.listedShares ?? null;
}

/** Select DB row fields explicitly so future KoreanTickerEntry fields are not persisted accidentally. */
function toKoreanTickerRow(entry: KoreanTickerUpsertEntry): KoreanTickerRow {
    return {
        symbol: entry.symbol,
        name: entry.name,
        koreanName: entry.koreanName,
        exchange: entry.exchange,
        exchangeFullName: entry.exchangeFullName,
        listedShares: entry.listedShares ?? null,
    };
}
