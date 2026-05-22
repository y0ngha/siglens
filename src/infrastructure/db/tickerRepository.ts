import type { KoreanTickerEntry } from '@/domain/types';
import { eq, inArray, sql } from 'drizzle-orm';
import { NEON_TRANSIENT_RETRY } from '@/infrastructure/db/isNeonTransientError';
import {
    assetTranslations,
    koreanTickers,
    profileDescriptionTranslations,
} from '@/infrastructure/db/schema';
import type { SiglensDatabase } from '@/infrastructure/db/types';
import type {
    AssetTranslationRecord,
    AssetTranslationRepository,
    KoreanTickerRepository,
    ProfileDescriptionTranslationRecord,
    ProfileDescriptionTranslationRepository,
} from '@/infrastructure/db/types';
import { withRetry } from '@/infrastructure/utils/withRetry';

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

    async findAll(): Promise<KoreanTickerEntry[]> {
        return this.db.select(koreanTickerColumns).from(koreanTickers);
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
