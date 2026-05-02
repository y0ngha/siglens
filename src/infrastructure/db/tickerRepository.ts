import type { KoreanTickerEntry } from '@/domain/types';
import { eq, inArray, sql } from 'drizzle-orm';
import { assetTranslations, koreanTickers } from '@/infrastructure/db/schema';
import type { SiglensDatabase } from '@/infrastructure/db/types';
import type {
    AssetTranslationRecord,
    AssetTranslationRepository,
    KoreanTickerRepository,
} from '@/infrastructure/db/types';

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

        await this.db
            .insert(koreanTickers)
            .values(entries.map(toKoreanTickerRow))
            .onConflictDoUpdate({
                target: koreanTickers.symbol,
                set: {
                    name: sql`excluded.name`,
                    koreanName: sql`excluded.korean_name`,
                    exchange: sql`excluded.exchange`,
                    exchangeFullName: sql`excluded.exchange_full_name`,
                },
            });
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
        await this.db
            .insert(assetTranslations)
            .values(record)
            .onConflictDoUpdate({
                target: assetTranslations.symbol,
                set: {
                    name: sql`excluded.name`,
                    koreanName: sql`excluded.korean_name`,
                    fmpSymbol: sql`excluded.fmp_symbol`,
                },
            });
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
