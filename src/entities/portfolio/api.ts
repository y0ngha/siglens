import { and, eq, sql } from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
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
 * {@link PortfolioHoldingRepository}의 PostgreSQL(Drizzle) 구현. (userId, symbol)당 한 행이며,
 * `upsert`는 `portfolio_holdings_user_symbol_uidx` 유니크 인덱스로 같은 심볼의 반복 제출을
 * 중복 행 없이 병합한다.
 *
 * 모든 메서드는 쿼리를 `withRetry(DB_TRANSIENT_RETRY)`로 감싼다 — 재시도는 액션 호출부마다
 * 흩뿌리지 않고 리포지토리 계층에서 일괄 적용한다.
 */
export class DrizzlePortfolioRepository implements PortfolioHoldingRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /** 회원의 보유종목 전체 행을 정렬 없이 돌려준다. 정렬은 호출자(액션) 책임이다. */
    async findByUser(userId: string): Promise<PortfolioHoldingRecord[]> {
        return withRetry(
            () =>
                this.db
                    .select(columns)
                    .from(portfolioHoldings)
                    .where(eq(portfolioHoldings.userId, userId)),
            DB_TRANSIENT_RETRY
        );
    }

    /** 한 심볼의 보유 행을 돌려준다. 없으면 `null`. `symbol`은 대문자 정규형이어야 한다. */
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
            DB_TRANSIENT_RETRY
        );
        return row ?? null;
    }

    /**
     * (userId, symbol) 기준으로 삽입하거나 갱신한다. 충돌 시 수량·평단은 덮어쓰고,
     * `companyName`·`fmpSymbol`은 새 값이 `null`이면 기존 값을 보존한다.
     */
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
                        // 들어온 값이 null이면 COALESCE로 기존 메타데이터를 보존한다 — 여기서 null은
                        // 항상 "이번 편집에서 심볼 해석이 degrade됨"이지 "비어 있음이 확인됨"이
                        // 아니다(getAssetInfo가 진짜 null을 주면 upsert 전에 symbol_not_found로
                        // 거부된다). 이게 없으면 FMP 장애 중 수량/평단을 고칠 때 이전에 저장된 올바른
                        // companyName/fmpSymbol이 조용히 지워진다.
                        set: {
                            companyName: sql`coalesce(${input.companyName}, ${portfolioHoldings.companyName})`,
                            fmpSymbol: sql`coalesce(${input.fmpSymbol}, ${portfolioHoldings.fmpSymbol})`,
                            quantity: input.quantity,
                            averagePrice: input.averagePrice,
                            updatedAt: sql`now()`,
                        },
                    })
                    .returning(columns),
            DB_TRANSIENT_RETRY
        );

        if (row === undefined) {
            throw new Error('Failed to upsert portfolio holding');
        }
        return row;
    }

    /** 보유 행을 지우고 실제로 지워졌는지(`true`) 돌려준다. 이미 없으면 `false`. */
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
            DB_TRANSIENT_RETRY
        );

        return deleted.length > 0;
    }
}
