import { and, eq, sql } from 'drizzle-orm';
import { NEON_TRANSIENT_RETRY } from '@/shared/db/isNeonTransientError';
import { portfolioHoldings } from '@/shared/db/schema';
import type {
    PortfolioHoldingRecord,
    PortfolioHoldingRepository,
    SiglensDatabase,
    UpsertPortfolioHoldingInput,
} from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';

const columns = {
    id: portfolioHoldings.id,
    userId: portfolioHoldings.userId,
    symbol: portfolioHoldings.symbol,
    companyName: portfolioHoldings.companyName,
    fmpSymbol: portfolioHoldings.fmpSymbol,
    quantity: portfolioHoldings.quantity,
    averagePrice: portfolioHoldings.averagePrice,
    createdAt: portfolioHoldings.createdAt,
    updatedAt: portfolioHoldings.updatedAt,
};

/**
 * Drizzle ORM implementation of {@link PortfolioHoldingRepository} backed by
 * Neon PostgreSQL. One row per (userId, symbol); `upsert` relies on the
 * `portfolio_holdings_user_symbol_uidx` unique index to merge repeat
 * submissions for the same symbol instead of accumulating duplicate rows.
 *
 * Every method wraps its query in `withRetry(NEON_TRANSIENT_RETRY)` — retry
 * is a repository-layer concern, applied uniformly here rather than
 * scattered across individual action call sites.
 */
export class DrizzlePortfolioRepository implements PortfolioHoldingRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async findByUser(userId: string): Promise<PortfolioHoldingRecord[]> {
        return withRetry(
            () =>
                this.db
                    .select(columns)
                    .from(portfolioHoldings)
                    .where(eq(portfolioHoldings.userId, userId)),
            NEON_TRANSIENT_RETRY
        );
    }

    /**
     * Intentionally has no production caller yet — spec §4-mandated and
     * forward-provisioned for subsystem B ("where am I" position lookup for
     * a single symbol) and subsystem C (personalized analysis keyed off one
     * holding). Kept in place (and unit-tested) as a deliberate seam rather
     * than accidental dead code.
     */
    async findByUserAndSymbol(
        userId: string,
        symbol: string
    ): Promise<PortfolioHoldingRecord | null> {
        const [row] = await withRetry(
            () =>
                this.db
                    .select(columns)
                    .from(portfolioHoldings)
                    .where(
                        and(
                            eq(portfolioHoldings.userId, userId),
                            eq(portfolioHoldings.symbol, symbol)
                        )
                    )
                    .limit(1),
            NEON_TRANSIENT_RETRY
        );
        return row ?? null;
    }

    async upsert(
        input: UpsertPortfolioHoldingInput
    ): Promise<PortfolioHoldingRecord> {
        const [row] = await withRetry(
            () =>
                this.db
                    .insert(portfolioHoldings)
                    .values({
                        userId: input.userId,
                        symbol: input.symbol,
                        companyName: input.companyName,
                        fmpSymbol: input.fmpSymbol,
                        quantity: input.quantity,
                        averagePrice: input.averagePrice,
                    })
                    .onConflictDoUpdate({
                        target: [
                            portfolioHoldings.userId,
                            portfolioHoldings.symbol,
                        ],
                        // COALESCE preserves the previously-stored metadata when the
                        // incoming value is null — a null here always means "symbol
                        // resolution degraded on this edit", never "known to be
                        // empty" (a genuine null from getAssetInfo is rejected as
                        // symbol_not_found before reaching upsert). Without this,
                        // editing quantity/price during an FMP outage would silently
                        // wipe out the correct companyName/fmpSymbol saved earlier.
                        set: {
                            companyName: sql`coalesce(${input.companyName}, ${portfolioHoldings.companyName})`,
                            fmpSymbol: sql`coalesce(${input.fmpSymbol}, ${portfolioHoldings.fmpSymbol})`,
                            quantity: input.quantity,
                            averagePrice: input.averagePrice,
                            updatedAt: sql`now()`,
                        },
                    })
                    .returning(columns),
            NEON_TRANSIENT_RETRY
        );

        if (row === undefined) {
            throw new Error('Failed to upsert portfolio holding');
        }
        return row;
    }

    async deleteByUserAndSymbol(
        userId: string,
        symbol: string
    ): Promise<boolean> {
        const deleted = await withRetry(
            () =>
                this.db
                    .delete(portfolioHoldings)
                    .where(
                        and(
                            eq(portfolioHoldings.userId, userId),
                            eq(portfolioHoldings.symbol, symbol)
                        )
                    )
                    .returning({ id: portfolioHoldings.id }),
            NEON_TRANSIENT_RETRY
        );

        return deleted.length > 0;
    }
}
