// withRetry 내부 sleep을 즉시 resolve로 stubbing해서 transient retry 케이스의
// 실제 대기 시간을 없앤다. `vi.mock` 은 정적 import 보다 먼저 평가되도록
// 호이스트되어야 한다 (`import/first` 규칙과 일치).
vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

import { and, eq } from 'drizzle-orm';
import { portfolioHoldings } from '@/shared/db/schema';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import type { SiglensDatabase } from '@/shared/db/types';

const createdAt = new Date('2026-05-01T00:00:00.000Z');
const updatedAt = new Date('2026-05-01T00:00:01.000Z');

const holdingRow = {
    id: 'holding-1',
    userId: 'user-1',
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    fmpSymbol: 'AAPL',
    quantity: '10.00000000',
    averagePrice: '150.00000000',
    createdAt,
    updatedAt,
};

const UPSERT_INPUT = {
    userId: 'user-1',
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    fmpSymbol: 'AAPL',
    quantity: '10',
    averagePrice: '150',
};

function makeUpsertDb(rows: unknown[]): {
    db: SiglensDatabase;
    insert: ReturnType<typeof vi.fn>;
    values: ReturnType<typeof vi.fn>;
    onConflictDoUpdate: ReturnType<typeof vi.fn>;
    returning: ReturnType<typeof vi.fn>;
} {
    const returning = vi.fn().mockResolvedValue(rows);
    const onConflictDoUpdate = vi.fn(() => ({ returning }));
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));

    return {
        db: { insert } as unknown as SiglensDatabase,
        insert,
        values,
        onConflictDoUpdate,
        returning,
    };
}

function makeFindByUserDb(rows: unknown[]): {
    db: SiglensDatabase;
    where: ReturnType<typeof vi.fn>;
} {
    const where = vi.fn().mockResolvedValue(rows);
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    return {
        db: { select } as unknown as SiglensDatabase,
        where,
    };
}

function makeFindByUserAndSymbolDb(rows: unknown[]): {
    db: SiglensDatabase;
    limit: ReturnType<typeof vi.fn>;
} {
    const limit = vi.fn().mockResolvedValue(rows);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    return {
        db: { select } as unknown as SiglensDatabase,
        limit,
    };
}

function makeDeleteDb(rows: unknown[]): {
    db: SiglensDatabase;
    delete: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    returning: ReturnType<typeof vi.fn>;
} {
    const returning = vi.fn().mockResolvedValue(rows);
    const where = vi.fn(() => ({ returning }));
    const deleteFn = vi.fn(() => ({ where }));
    return {
        db: { delete: deleteFn } as unknown as SiglensDatabase,
        delete: deleteFn,
        where,
        returning,
    };
}

describe('DrizzlePortfolioRepository.upsert', () => {
    it('inserts with onConflictDoUpdate targeting (userId, symbol) and returns the row', async () => {
        const { db, values, onConflictDoUpdate, returning } = makeUpsertDb([
            holdingRow,
        ]);
        const repo = new DrizzlePortfolioRepository(db);

        const result = await repo.upsert(UPSERT_INPUT);

        expect(result).toEqual(holdingRow);

        const [insertedValues] = values.mock.calls[0] ?? [];
        expect(insertedValues).toMatchObject({
            userId: 'user-1',
            symbol: 'AAPL',
            companyName: 'Apple Inc.',
            fmpSymbol: 'AAPL',
            quantity: '10',
            averagePrice: '150',
        });

        const [conflictArgs] = onConflictDoUpdate.mock.calls[0] ?? [];
        const { target, set } = conflictArgs as {
            target: unknown[];
            set: { quantity: string; averagePrice: string };
        };
        expect(target).toEqual([
            portfolioHoldings.userId,
            portfolioHoldings.symbol,
        ]);
        expect(set.quantity).toBe('10');
        expect(set.averagePrice).toBe('150');
        expect(returning).toHaveBeenCalledTimes(1);
    });

    it('throws when the database returns no row (defensive guard)', async () => {
        const { db } = makeUpsertDb([]);
        const repo = new DrizzlePortfolioRepository(db);

        await expect(repo.upsert(UPSERT_INPUT)).rejects.toThrow(
            'Failed to upsert portfolio holding'
        );
    });

    it('retries once on a transient Neon error and succeeds', async () => {
        const neonTransient = Object.assign(
            new Error('Error connecting to database: fetch failed'),
            { name: 'NeonDbError' }
        );
        const returning = vi
            .fn()
            .mockRejectedValueOnce(neonTransient)
            .mockResolvedValueOnce([holdingRow]);
        const onConflictDoUpdate = vi.fn(() => ({ returning }));
        const values = vi.fn(() => ({ onConflictDoUpdate }));
        const insert = vi.fn(() => ({ values }));
        const db = { insert } as unknown as SiglensDatabase;
        const repo = new DrizzlePortfolioRepository(db);

        await expect(repo.upsert(UPSERT_INPUT)).resolves.toEqual(holdingRow);
        expect(insert).toHaveBeenCalledTimes(2);
    });
});

describe('DrizzlePortfolioRepository.findByUser', () => {
    it('filters by the userId column with the exact userId value and returns rows', async () => {
        const rows = [
            holdingRow,
            { ...holdingRow, id: 'holding-2', symbol: 'MSFT' },
        ];
        const { db, where } = makeFindByUserDb(rows);
        const repo = new DrizzlePortfolioRepository(db);

        const result = await repo.findByUser('user-1');

        expect(result).toEqual(rows);
        expect(where).toHaveBeenCalledTimes(1);
        expect(where.mock.calls[0]?.[0]).toEqual(
            eq(portfolioHoldings.userId, 'user-1')
        );
    });

    it('scopes the filter to the requesting userId, not some other user', async () => {
        const { db, where } = makeFindByUserDb([]);
        const repo = new DrizzlePortfolioRepository(db);

        await repo.findByUser('user-1');

        expect(where.mock.calls[0]?.[0]).not.toEqual(
            eq(portfolioHoldings.userId, 'some-other-user')
        );
    });

    it('returns an empty array when the user has no holdings', async () => {
        const { db } = makeFindByUserDb([]);
        const repo = new DrizzlePortfolioRepository(db);

        await expect(repo.findByUser('user-1')).resolves.toEqual([]);
    });

    it('retries once on a transient Neon error and succeeds', async () => {
        const neonTransient = Object.assign(
            new Error('Error connecting to database: fetch failed'),
            { name: 'NeonDbError' }
        );
        const where = vi
            .fn()
            .mockRejectedValueOnce(neonTransient)
            .mockResolvedValueOnce([holdingRow]);
        const from = vi.fn(() => ({ where }));
        const select = vi.fn(() => ({ from }));
        const db = { select } as unknown as SiglensDatabase;
        const repo = new DrizzlePortfolioRepository(db);

        await expect(repo.findByUser('user-1')).resolves.toEqual([holdingRow]);
        expect(select).toHaveBeenCalledTimes(2);
    });
});

describe('DrizzlePortfolioRepository.findByUserAndSymbol', () => {
    it('returns null when no row exists', async () => {
        const { db } = makeFindByUserAndSymbolDb([]);
        const repo = new DrizzlePortfolioRepository(db);

        await expect(
            repo.findByUserAndSymbol('user-1', 'AAPL')
        ).resolves.toBeNull();
    });

    it('returns the row when it exists', async () => {
        const { db } = makeFindByUserAndSymbolDb([holdingRow]);
        const repo = new DrizzlePortfolioRepository(db);

        await expect(
            repo.findByUserAndSymbol('user-1', 'AAPL')
        ).resolves.toEqual(holdingRow);
    });

    it('retries once on a transient Neon error and succeeds', async () => {
        const neonTransient = Object.assign(
            new Error('Error connecting to database: fetch failed'),
            { name: 'NeonDbError' }
        );
        const limit = vi
            .fn()
            .mockRejectedValueOnce(neonTransient)
            .mockResolvedValueOnce([holdingRow]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        const select = vi.fn(() => ({ from }));
        const db = { select } as unknown as SiglensDatabase;
        const repo = new DrizzlePortfolioRepository(db);

        await expect(
            repo.findByUserAndSymbol('user-1', 'AAPL')
        ).resolves.toEqual(holdingRow);
        expect(select).toHaveBeenCalledTimes(2);
    });
});

describe('DrizzlePortfolioRepository.deleteByUserAndSymbol', () => {
    it('returns false when no row was deleted', async () => {
        const { db } = makeDeleteDb([]);
        const repo = new DrizzlePortfolioRepository(db);

        await expect(
            repo.deleteByUserAndSymbol('user-1', 'AAPL')
        ).resolves.toBe(false);
    });

    it('returns true when a row was deleted', async () => {
        const { db, returning } = makeDeleteDb([{ id: 'holding-1' }]);
        const repo = new DrizzlePortfolioRepository(db);

        await expect(
            repo.deleteByUserAndSymbol('user-1', 'AAPL')
        ).resolves.toBe(true);
        expect(returning).toHaveBeenCalledTimes(1);
    });

    it("filters by both the userId and symbol columns with the exact values, so it cannot delete another user's row", async () => {
        const { db, where } = makeDeleteDb([{ id: 'holding-1' }]);
        const repo = new DrizzlePortfolioRepository(db);

        await repo.deleteByUserAndSymbol('user-1', 'AAPL');

        expect(where.mock.calls[0]?.[0]).toEqual(
            and(
                eq(portfolioHoldings.userId, 'user-1'),
                eq(portfolioHoldings.symbol, 'AAPL')
            )
        );
    });

    it('retries once on a transient Neon error and succeeds', async () => {
        const neonTransient = Object.assign(
            new Error('Error connecting to database: fetch failed'),
            { name: 'NeonDbError' }
        );
        const returning = vi
            .fn()
            .mockRejectedValueOnce(neonTransient)
            .mockResolvedValueOnce([{ id: 'holding-1' }]);
        const where = vi.fn(() => ({ returning }));
        const deleteFn = vi.fn(() => ({ where }));
        const db = { delete: deleteFn } as unknown as SiglensDatabase;
        const repo = new DrizzlePortfolioRepository(db);

        await expect(
            repo.deleteByUserAndSymbol('user-1', 'AAPL')
        ).resolves.toBe(true);
        expect(deleteFn).toHaveBeenCalledTimes(2);
    });
});
