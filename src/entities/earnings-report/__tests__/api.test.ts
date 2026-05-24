// withRetry 내부 sleep을 즉시 resolve로 stubbing해서 transient retry 케이스의
// 실제 대기 시간을 없앤다. `jest.mock` 은 정적 import 보다 먼저 평가되도록
// 호이스트되어야 한다 (`import/first` 규칙과 일치).
jest.mock('@/shared/lib/sleep', () => ({
    sleep: jest.fn().mockResolvedValue(undefined),
}));

import type { SiglensDatabase } from '@/shared/db/types';
import {
    dedupeEarningsReportInputs,
    DrizzleEarningsReportsRepository,
    toComparisonItems,
    type EarningsReportUpsertInput,
} from '@/entities/earnings-report';

const rawPayload = {
    date: '2025-08-01',
    symbol: 'AAPL',
    eps: 1.53,
    revenue: 90_000_000_000,
};

const reportInput: EarningsReportUpsertInput = {
    symbol: 'AAPL',
    earningsDate: '2025-08-01',
    epsActual: 1.53,
    epsEstimated: 1.48,
    revenueActual: 90_000_000_000,
    revenueEstimated: 89_500_000_000,
    lastUpdated: '2025-08-02',
    rawPayload,
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

function makeSelectWhereDb(rows: unknown[]): {
    db: SiglensDatabase;
    select: jest.Mock;
} {
    const where = jest.fn().mockResolvedValue(rows);
    const from = jest.fn(() => ({ where }));
    const select = jest.fn(() => ({ from }));
    return {
        db: { select } as unknown as SiglensDatabase,
        select,
    };
}

// --- Tests ---

describe('DrizzleEarningsReportsRepository', () => {
    describe('upsertMany', () => {
        it('정규화된 EPS/매출 필드를 함께 저장한다', async () => {
            const { db, values, onConflictDoUpdate } = makeUpsertDb();
            const repo = new DrizzleEarningsReportsRepository(db);

            await repo.upsertMany([reportInput]);

            const rows = values.mock.calls[0][0] as Record<string, unknown>[];
            expect(rows).toEqual([
                expect.objectContaining({
                    symbol: 'AAPL',
                    earningsDate: '2025-08-01',
                    epsActual: '1.53',
                    epsEstimated: '1.48',
                    revenueActual: '90000000000',
                    revenueEstimated: '89500000000',
                    lastUpdated: '2025-08-02',
                    rawPayload,
                }),
            ]);
            expect(onConflictDoUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    set: expect.objectContaining({
                        epsActual: expect.anything(),
                        epsEstimated: expect.anything(),
                        revenueActual: expect.anything(),
                        revenueEstimated: expect.anything(),
                        lastUpdated: expect.anything(),
                        rawPayload: expect.anything(),
                    }),
                })
            );
        });

        it('빈 배열에서는 insert 를 호출하지 않는다', async () => {
            const { db, insert } = makeUpsertDb();
            const repo = new DrizzleEarningsReportsRepository(db);

            await repo.upsertMany([]);

            expect(insert).not.toHaveBeenCalled();
        });

        it('같은 symbol + earningsDate 중복은 최신 lastUpdated 값만 저장한다', async () => {
            const { db, values } = makeUpsertDb();
            const repo = new DrizzleEarningsReportsRepository(db);
            const staleReportInput: EarningsReportUpsertInput = {
                ...reportInput,
                epsActual: null,
                lastUpdated: '2025-08-01',
            };

            await repo.upsertMany([reportInput, staleReportInput]);

            const rows = values.mock.calls[0][0] as Record<string, unknown>[];
            expect(rows).toHaveLength(1);
            expect(rows[0]).toEqual(
                expect.objectContaining({
                    epsActual: '1.53',
                    lastUpdated: '2025-08-02',
                })
            );
        });
    });

    describe('getLatestFetchedAt', () => {
        it('가장 최근 fetchedAt 을 반환한다', async () => {
            const fetchedAt = new Date('2026-05-10T00:00:00.000Z');
            const { db } = makeSelectLimitDb([{ fetchedAt }]);
            const repo = new DrizzleEarningsReportsRepository(db);

            await expect(repo.getLatestFetchedAt('AAPL')).resolves.toBe(
                fetchedAt
            );
        });

        it('row 가 없으면 null 을 반환한다', async () => {
            const { db } = makeSelectLimitDb([]);
            const repo = new DrizzleEarningsReportsRepository(db);

            await expect(repo.getLatestFetchedAt('AAPL')).resolves.toBeNull();
        });
    });

    describe('getComparisonItems', () => {
        it('past-2, past-1, future 순서로 비교 항목을 반환한다', async () => {
            const { db } = makeSelectWhereDb([
                {
                    symbol: 'AAPL',
                    earningsDate: '2026-07-30',
                    epsActual: null,
                    epsEstimated: '1.86',
                    revenueActual: null,
                    revenueEstimated: '107618800000',
                    lastUpdated: '2026-05-10',
                },
                {
                    symbol: 'AAPL',
                    earningsDate: '2026-04-30',
                    epsActual: '2.01',
                    epsEstimated: '1.95',
                    revenueActual: '111184000000',
                    revenueEstimated: '109457600000',
                    lastUpdated: '2026-05-10',
                },
                {
                    symbol: 'AAPL',
                    earningsDate: '2026-01-29',
                    epsActual: '2.85',
                    epsEstimated: '2.67',
                    revenueActual: '143756000000',
                    revenueEstimated: '138391000000',
                    lastUpdated: '2026-04-29',
                },
            ]);
            const repo = new DrizzleEarningsReportsRepository(db);

            await expect(
                repo.getComparisonItems('AAPL', '2026-05-10')
            ).resolves.toEqual([
                expect.objectContaining({
                    earningsDate: '2026-01-29',
                    period: 'past',
                    slot: 'past-2',
                    epsActual: 2.85,
                }),
                expect.objectContaining({
                    earningsDate: '2026-04-30',
                    period: 'past',
                    slot: 'past-1',
                    revenueActual: 111184000000,
                }),
                expect.objectContaining({
                    earningsDate: '2026-07-30',
                    period: 'future',
                    slot: 'recent-or-future',
                    epsEstimated: 1.86,
                }),
            ]);
        });
    });

    describe('toComparisonItems', () => {
        it('미래 항목이 없으면 최근 과거 3개를 오래된 순서부터 반환한다', () => {
            expect(
                toComparisonItems(
                    [
                        {
                            symbol: 'AAPL',
                            earningsDate: '2026-04-30',
                            epsActual: '2.01',
                            epsEstimated: '1.95',
                            revenueActual: '111184000000',
                            revenueEstimated: '109457600000',
                            lastUpdated: '2026-05-10',
                        },
                        {
                            symbol: 'AAPL',
                            earningsDate: '2026-01-29',
                            epsActual: '2.85',
                            epsEstimated: '2.67',
                            revenueActual: '143756000000',
                            revenueEstimated: '138391000000',
                            lastUpdated: '2026-04-29',
                        },
                        {
                            symbol: 'AAPL',
                            earningsDate: '2025-10-30',
                            epsActual: '1.85',
                            epsEstimated: '1.77',
                            revenueActual: '102466000000',
                            revenueEstimated: '102240000000',
                            lastUpdated: '2026-01-01',
                        },
                    ],
                    '2026-05-10'
                ).map(item => [item.earningsDate, item.slot])
            ).toEqual([
                ['2025-10-30', 'past-2'],
                ['2026-01-29', 'past-1'],
                ['2026-04-30', 'recent-or-future'],
            ]);
        });
    });

    describe('dedupeEarningsReportInputs', () => {
        it('lastUpdated 가 같으면 값이 더 많이 채워진 항목을 남긴다', () => {
            const sparse: EarningsReportUpsertInput = {
                ...reportInput,
                epsActual: null,
                revenueActual: null,
            };

            expect(dedupeEarningsReportInputs([reportInput, sparse])).toEqual([
                reportInput,
            ]);
        });
    });

    // upsertMany 가 NEON_TRANSIENT_RETRY 정책을 실제로 통과시키는지 확인하는
    // smoke 테스트. withRetry/isNeonTransientError 자체의 동작은 각자의
    // 단위 테스트에서 검증하므로 여기서는 "정책이 wire-up 됐다"만 보장한다.
    describe('Neon transient retry wire-up', () => {
        it('transient NeonDbError 가 발생하면 재시도해 결국 성공한다', async () => {
            const neonTransient = Object.assign(
                new Error('Error connecting to database: fetch failed'),
                { name: 'NeonDbError' }
            );
            const onConflictDoUpdate = jest
                .fn()
                .mockRejectedValueOnce(neonTransient)
                .mockResolvedValueOnce(undefined);
            const values = jest.fn(() => ({ onConflictDoUpdate }));
            const insert = jest.fn(() => ({ values }));
            const db = { insert } as unknown as SiglensDatabase;
            const repo = new DrizzleEarningsReportsRepository(db);

            await expect(
                repo.upsertMany([reportInput])
            ).resolves.toBeUndefined();
            expect(insert).toHaveBeenCalledTimes(2);
            expect(onConflictDoUpdate).toHaveBeenCalledTimes(2);
        });

        it('non-transient 에러는 재시도 없이 즉시 전파한다', async () => {
            const constraintError = Object.assign(
                new Error(
                    'duplicate key value violates unique constraint "earnings_reports_pkey"'
                ),
                { name: 'NeonDbError' }
            );
            const onConflictDoUpdate = jest
                .fn()
                .mockRejectedValueOnce(constraintError);
            const values = jest.fn(() => ({ onConflictDoUpdate }));
            const insert = jest.fn(() => ({ values }));
            const db = { insert } as unknown as SiglensDatabase;
            const repo = new DrizzleEarningsReportsRepository(db);

            await expect(repo.upsertMany([reportInput])).rejects.toBe(
                constraintError
            );
            expect(insert).toHaveBeenCalledTimes(1);
        });
    });
});
