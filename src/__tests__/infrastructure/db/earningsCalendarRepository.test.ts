import type { EarningsCalendarItem } from '@y0ngha/siglens-core';
import type { SiglensDatabase } from '@/infrastructure/db/types';
import {
    DrizzleEarningsCalendarRepository,
    toCalendarRow,
} from '@/infrastructure/db/earningsCalendarRepository';

const appleQ2: EarningsCalendarItem = {
    symbol: 'AAPL',
    earningsDate: '2025-08-01',
    epsActual: 1.53,
    epsEstimated: 1.48,
    revenueActual: 90_000_000_000,
    revenueEstimated: 89_500_000_000,
    lastUpdated: '2025-08-02',
};

const appleQ3: EarningsCalendarItem = {
    symbol: 'AAPL',
    earningsDate: '2025-11-01',
    epsActual: null,
    epsEstimated: 1.55,
    revenueActual: null,
    revenueEstimated: 91_000_000_000,
    lastUpdated: '2025-08-02',
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
    limit: jest.Mock;
    select: jest.Mock;
} {
    const limit = jest.fn().mockResolvedValue(rows);
    const orderBy = jest.fn(() => ({ limit }));
    const where = jest.fn(() => ({ orderBy }));
    const from = jest.fn(() => ({ where }));
    const select = jest.fn(() => ({ from }));
    return {
        db: { select } as unknown as SiglensDatabase,
        limit,
        select,
    };
}

function makeSelectOrderByDb(rows: unknown[]): {
    db: SiglensDatabase;
    select: jest.Mock;
    orderBy: jest.Mock;
} {
    const orderBy = jest.fn().mockResolvedValue(rows);
    const where = jest.fn(() => ({ orderBy }));
    const from = jest.fn(() => ({ where }));
    const select = jest.fn(() => ({ from }));
    return {
        db: { select } as unknown as SiglensDatabase,
        select,
        orderBy,
    };
}

// Use the production mapper to produce DB row fixtures — exercises the same
// code path as upsertMany and avoids duplicating the mapping logic in tests.
const toDbRow = toCalendarRow;

// --- Tests ---

describe('DrizzleEarningsCalendarRepository', () => {
    describe('upsertMany', () => {
        it('빈 배열에서는 insert 를 호출하지 않는다', async () => {
            const { db, insert } = makeUpsertDb();
            const repo = new DrizzleEarningsCalendarRepository(db);
            await repo.upsertMany([]);
            expect(insert).not.toHaveBeenCalled();
        });

        it('여러 항목을 insert + onConflictDoUpdate 로 저장한다', async () => {
            const { db, insert, values, onConflictDoUpdate } = makeUpsertDb();
            const repo = new DrizzleEarningsCalendarRepository(db);
            await repo.upsertMany([appleQ2, appleQ3]);

            expect(insert).toHaveBeenCalledTimes(1);
            expect(values).toHaveBeenCalledTimes(1);
            const rows = values.mock.calls[0][0] as unknown[];
            expect(rows).toHaveLength(2);
            expect(onConflictDoUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    set: expect.objectContaining({
                        epsActual: expect.anything(),
                        epsEstimated: expect.anything(),
                        revenueActual: expect.anything(),
                        revenueEstimated: expect.anything(),
                    }),
                })
            );
        });
    });

    describe('getNextForSymbol', () => {
        it('row 가 있으면 EarningsCalendarItem 을 반환한다', async () => {
            const { db } = makeSelectLimitDb([toDbRow(appleQ3)]);
            const repo = new DrizzleEarningsCalendarRepository(db);
            const result = await repo.getNextForSymbol('AAPL', '2025-09-01');

            expect(result).not.toBeNull();
            expect(result?.symbol).toBe('AAPL');
            expect(result?.earningsDate).toBe('2025-11-01');
            // numeric strings → numbers
            expect(result?.epsEstimated).toBe(1.55);
            expect(result?.epsActual).toBeNull();
        });

        it('row 가 없으면 null 을 반환한다', async () => {
            const { db } = makeSelectLimitDb([]);
            const repo = new DrizzleEarningsCalendarRepository(db);
            const result = await repo.getNextForSymbol('AAPL', '2099-01-01');
            expect(result).toBeNull();
        });

        it('throws when DB row has null lastUpdated', async () => {
            const { db } = makeSelectLimitDb([
                { ...toDbRow(appleQ3), lastUpdated: null },
            ]);
            const repo = new DrizzleEarningsCalendarRepository(db);
            await expect(
                repo.getNextForSymbol('AAPL', '2025-09-01')
            ).rejects.toThrow(/AAPL.*2025-11-01/);
        });
    });

    describe('listForRange', () => {
        it('범위 내 모든 항목을 반환한다', async () => {
            const { db, orderBy } = makeSelectOrderByDb([
                toDbRow(appleQ2),
                toDbRow(appleQ3),
            ]);
            const repo = new DrizzleEarningsCalendarRepository(db);
            const results = await repo.listForRange('2025-08-01', '2025-12-31');

            expect(results).toHaveLength(2);
            expect(results[0]?.symbol).toBe('AAPL');
            expect(orderBy).toHaveBeenCalledTimes(1);
        });

        it('범위 내 항목이 없으면 빈 배열을 반환한다', async () => {
            const { db } = makeSelectOrderByDb([]);
            const repo = new DrizzleEarningsCalendarRepository(db);
            const results = await repo.listForRange('2099-01-01', '2099-12-31');
            expect(results).toEqual([]);
        });
    });
});
