import type { EarningsReport } from '@y0ngha/siglens-core';
import type { SiglensDatabase } from '@/infrastructure/db/types';
import { DrizzleEarningsReportsRepository } from '@/infrastructure/db/earningsReportsRepository';

const report: EarningsReport = {
    symbol: 'AAPL',
    earningsDate: '2025-08-01',
};

const rawPayload = {
    date: '2025-08-01',
    symbol: 'AAPL',
    eps: 1.53,
    revenue: 90_000_000_000,
};

// --- DB mock helpers ---

function makeUpsertDb(): {
    db: SiglensDatabase;
    insert: jest.Mock;
    values: jest.Mock;
    onConflictDoUpdate: jest.Mock;
} {
    const onConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
    const values = jest.fn(() => ({ onConflictDoUpdate }));
    const insert = jest.fn(() => ({ values }));
    return {
        db: { insert } as unknown as SiglensDatabase,
        insert,
        values,
        onConflictDoUpdate,
    };
}

function makeSelectLimitDb(rows: unknown[]): {
    db: SiglensDatabase;
    select: jest.Mock;
    limit: jest.Mock;
} {
    const limit = jest.fn().mockResolvedValue(rows);
    const orderBy = jest.fn(() => ({ limit }));
    const where = jest.fn(() => ({ orderBy }));
    const from = jest.fn(() => ({ where }));
    const select = jest.fn(() => ({ from }));
    return {
        db: { select } as unknown as SiglensDatabase,
        select,
        limit,
    };
}

// --- Tests ---

describe('DrizzleEarningsReportsRepository', () => {
    describe('upsert', () => {
        it('insert + onConflictDoUpdate 를 호출한다', async () => {
            const { db, insert, values, onConflictDoUpdate } = makeUpsertDb();
            const repo = new DrizzleEarningsReportsRepository(db);
            await repo.upsert(report, rawPayload);

            expect(insert).toHaveBeenCalledTimes(1);
            expect(values).toHaveBeenCalledTimes(1);

            const row = values.mock.calls[0][0] as Record<string, unknown>;
            expect(row['symbol']).toBe('AAPL');
            expect(row['earningsDate']).toBe('2025-08-01');
            expect(row['rawPayload']).toBe(rawPayload);

            expect(onConflictDoUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    set: expect.objectContaining({
                        rawPayload: expect.anything(),
                        fetchedAt: expect.anything(),
                    }),
                })
            );
        });

        it('update 경로: 기존 row 가 있어도 동일한 query chain 을 사용한다', async () => {
            const { db, onConflictDoUpdate } = makeUpsertDb();
            const repo = new DrizzleEarningsReportsRepository(db);
            // Call twice to simulate update path (DB mock always resolves)
            await repo.upsert(report, rawPayload);
            await repo.upsert(report, { ...rawPayload, eps: 1.60 });
            expect(onConflictDoUpdate).toHaveBeenCalledTimes(2);
        });
    });

    describe('getLatestForSymbol', () => {
        it('row 가 있으면 EarningsReport 를 반환한다', async () => {
            const { db } = makeSelectLimitDb([
                { symbol: 'AAPL', earningsDate: '2025-08-01' },
            ]);
            const repo = new DrizzleEarningsReportsRepository(db);
            const result = await repo.getLatestForSymbol('AAPL');

            expect(result).not.toBeNull();
            expect(result?.symbol).toBe('AAPL');
            expect(result?.earningsDate).toBe('2025-08-01');
        });

        it('row 가 없으면 null 을 반환한다', async () => {
            const { db } = makeSelectLimitDb([]);
            const repo = new DrizzleEarningsReportsRepository(db);
            const result = await repo.getLatestForSymbol('AAPL');
            expect(result).toBeNull();
        });

        it('domain shape 에는 rawPayload 가 포함되지 않는다', async () => {
            const { db } = makeSelectLimitDb([
                { symbol: 'AAPL', earningsDate: '2025-08-01' },
            ]);
            const repo = new DrizzleEarningsReportsRepository(db);
            const result = await repo.getLatestForSymbol('AAPL');

            expect(result).not.toHaveProperty('rawPayload');
        });
    });
});
