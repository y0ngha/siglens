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
 */
export class DrizzlePortfolioRepository implements PortfolioHoldingRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async findByUser(userId: string): Promise<PortfolioHoldingRecord[]> {
        return this.db
            .select(columns)
            .from(portfolioHoldings)
            .where(eq(portfolioHoldings.userId, userId));
    }

    async findByUserAndSymbol(
        userId: string,
        symbol: string
    ): Promise<PortfolioHoldingRecord | null> {
        const [row] = await this.db
            .select(columns)
            .from(portfolioHoldings)
            .where(
                and(
                    eq(portfolioHoldings.userId, userId),
                    eq(portfolioHoldings.symbol, symbol)
                )
            )
            .limit(1);
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
                        set: {
                            companyName: input.companyName,
                            fmpSymbol: input.fmpSymbol,
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
        const deleted = await this.db
            .delete(portfolioHoldings)
            .where(
                and(
                    eq(portfolioHoldings.userId, userId),
                    eq(portfolioHoldings.symbol, symbol)
                )
            )
            .returning({ id: portfolioHoldings.id });

        return deleted.length > 0;
    }
}
