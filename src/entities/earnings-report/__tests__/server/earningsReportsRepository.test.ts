import type { Mock } from 'vitest';
// withRetry 내부 sleep을 즉시 resolve로 stubbing해서 transient retry 케이스의
// 실제 대기 시간을 없앤다. `vi.mock` 은 정적 import 보다 먼저 평가되도록
// 호이스트되어야 한다 (`import/first` 규칙과 일치).
vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

import { asc, desc, type SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SiglensDatabase } from '@/shared/db/types';
import { earningsReports } from '@/shared/db/schema';
import { DrizzleEarningsReportsRepository } from '../../server/earningsReportsRepository';
import type { EarningsReportUpsertInput } from '../../model';

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
    insert: Mock;
    values: Mock;
    onConflictDoUpdate: Mock;
} {
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));
    return {
        db: { insert } as unknown as SiglensDatabase,
        insert,
        values,
        onConflictDoUpdate,
    };
}

function makeSelectLimitDb(rows: unknown[]): {
    db: SiglensDatabase;
    select: Mock;
    orderBy: Mock;
    limit: Mock;
} {
    const limit = vi.fn().mockResolvedValue(rows);
    const orderBy = vi.fn(() => ({ limit }));
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    return {
        db: { select } as unknown as SiglensDatabase,
        select,
        orderBy,
        limit,
    };
}

function makeDeleteDb(): {
    db: SiglensDatabase;
    deleteFn: Mock;
    where: Mock;
} {
    const where = vi.fn().mockResolvedValue(undefined);
    const deleteFn = vi.fn(() => ({ where }));
    return {
        db: { delete: deleteFn } as unknown as SiglensDatabase,
        deleteFn,
        where,
    };
}

function renderSql(fragment: SQL): { sql: string; params: unknown[] } {
    return new PgDialect().sqlToQuery(fragment);
}

const upcomingRow = {
    symbol: 'AAPL',
    earningsDate: '2026-07-30',
    epsActual: null,
    epsEstimated: '1.86',
    revenueActual: null,
    revenueEstimated: '107618800000',
    lastUpdated: '2026-05-10',
    rawPayload: {},
    fetchedAt: new Date('2026-05-20T03:00:00.000Z'),
};

const upcomingInput: EarningsReportUpsertInput = {
    symbol: 'COP',
    earningsDate: '2026-11-05',
    epsActual: null,
    epsEstimated: 1.4,
    revenueActual: null,
    revenueEstimated: null,
    lastUpdated: '2026-10-21',
    rawPayload: {},
};

function makeSelectWhereDb(rows: unknown[]): {
    db: SiglensDatabase;
    select: Mock;
} {
    const where = vi.fn().mockResolvedValue(rows);
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
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

    describe('getNextForSymbol', () => {
        it('lastUpdated 가 null 인 행(yahoo 예정 행)도 버리지 않고 받아 온 날짜(KST)로 채운다', async () => {
            // 2026-05-20T16:00Z = KST 05-21 01:00 — UTC 날짜를 자르면 하루 이르게 찍힌다.
            const { db } = makeSelectLimitDb([
                {
                    ...upcomingRow,
                    lastUpdated: null,
                    fetchedAt: new Date('2026-05-20T16:00:00.000Z'),
                },
            ]);
            const repo = new DrizzleEarningsReportsRepository(db);

            await expect(
                repo.getNextForSymbol('AAPL', '2026-05-25')
            ).resolves.toEqual(
                expect.objectContaining({
                    earningsDate: '2026-07-30',
                    lastUpdated: '2026-05-21',
                })
            );
        });

        it('프로바이더가 추정일이라고 표시한 일정(yahoo isEstimate=true)은 분석 경로에 넘기지 않는다', async () => {
            const { db } = makeSelectLimitDb([
                { ...upcomingRow, rawPayload: { isEstimate: true } },
            ]);
            const repo = new DrizzleEarningsReportsRepository(db);

            await expect(
                repo.getNextForSymbol('AAPL', '2026-05-25')
            ).resolves.toBeNull();
        });

        it('확정일(isEstimate=false)과 확정 여부를 모르는 FMP 행은 분석 경로에 넘긴다', async () => {
            for (const rawPayload of [{ isEstimate: false }, {}]) {
                const { db } = makeSelectLimitDb([
                    { ...upcomingRow, rawPayload },
                ]);
                const repo = new DrizzleEarningsReportsRepository(db);

                await expect(
                    repo.getNextForSymbol('AAPL', '2026-05-25')
                ).resolves.toEqual(
                    expect.objectContaining({ earningsDate: '2026-07-30' })
                );
            }
        });

        it('미래 행이 여럿이면 가장 최근에 받아 온 일정을 고른다 (fetched_at 내림차순 → 날짜 오름차순)', async () => {
            const { db, orderBy } = makeSelectLimitDb([upcomingRow]);
            const repo = new DrizzleEarningsReportsRepository(db);

            await repo.getNextForSymbol('AAPL', '2026-05-25');

            expect(orderBy).toHaveBeenCalledTimes(1);
            const [first, second] = orderBy.mock.calls[0] as SQL[];
            expect(renderSql(first).sql).toBe(
                renderSql(desc(earningsReports.fetchedAt)).sql
            );
            expect(renderSql(second).sql).toBe(
                renderSql(asc(earningsReports.earningsDate)).sql
            );
        });

        it('row 가 없으면 null 반환', async () => {
            const { db } = makeSelectLimitDb([]);
            const repo = new DrizzleEarningsReportsRepository(db);

            await expect(
                repo.getNextForSymbol('AAPL', '2026-05-25')
            ).resolves.toBeNull();
        });

        it('정상 row 가 있으면 EarningsCalendarItem 반환', async () => {
            const { db } = makeSelectLimitDb([
                {
                    symbol: 'AAPL',
                    earningsDate: '2026-07-30',
                    epsActual: null,
                    epsEstimated: '1.86',
                    revenueActual: null,
                    revenueEstimated: '107618800000',
                    lastUpdated: '2026-05-10',
                },
            ]);
            const repo = new DrizzleEarningsReportsRepository(db);

            const result = await repo.getNextForSymbol('AAPL', '2026-05-25');
            expect(result).toEqual({
                symbol: 'AAPL',
                earningsDate: '2026-07-30',
                epsActual: null,
                epsEstimated: 1.86,
                revenueActual: null,
                revenueEstimated: 107618800000,
                lastUpdated: '2026-05-10',
            });
        });
    });

    describe('getNextScheduleForSymbol', () => {
        it('yahoo 추정일(rawPayload.isEstimate=true)이면 dateConfirmed=false', async () => {
            const { db } = makeSelectLimitDb([
                { ...upcomingRow, rawPayload: { isEstimate: true } },
            ]);
            const repo = new DrizzleEarningsReportsRepository(db);

            await expect(
                repo.getNextScheduleForSymbol('AAPL', '2026-05-25')
            ).resolves.toEqual(
                expect.objectContaining({ dateConfirmed: false })
            );
        });

        it('yahoo 확정일(isEstimate=false)이면 dateConfirmed=true', async () => {
            const { db } = makeSelectLimitDb([
                { ...upcomingRow, rawPayload: { isEstimate: false } },
            ]);
            const repo = new DrizzleEarningsReportsRepository(db);

            await expect(
                repo.getNextScheduleForSymbol('AAPL', '2026-05-25')
            ).resolves.toEqual(
                expect.objectContaining({ dateConfirmed: true })
            );
        });

        it('FMP 행(플래그 없음)이면 dateConfirmed=null', async () => {
            const { db } = makeSelectLimitDb([upcomingRow]);
            const repo = new DrizzleEarningsReportsRepository(db);

            await expect(
                repo.getNextScheduleForSymbol('AAPL', '2026-05-25')
            ).resolves.toEqual(
                expect.objectContaining({ dateConfirmed: null })
            );
        });
    });

    describe('pruneSupersededUpcoming', () => {
        it('응답에 새 예정일이 있으면 응답에 없는 미래 미발표 행을 지운다', async () => {
            const { db, deleteFn, where } = makeDeleteDb();
            const repo = new DrizzleEarningsReportsRepository(db);
            const pastInput: EarningsReportUpsertInput = {
                ...upcomingInput,
                earningsDate: '2026-08-07',
                epsActual: 1.42,
            };

            await repo.pruneSupersededUpcoming(
                'COP',
                [upcomingInput, pastInput],
                '2026-10-22'
            );

            expect(deleteFn).toHaveBeenCalledWith(earningsReports);
            const { sql: whereSql, params } = renderSql(
                where.mock.calls[0]![0] as SQL
            );
            expect(whereSql).toContain('"earnings_date" >=');
            expect(whereSql).toContain('"eps_actual" is null');
            expect(whereSql).toContain('"revenue_actual" is null');
            expect(whereSql).toContain('"earnings_date" not in');
            expect(params).toEqual([
                'COP',
                '2026-10-22',
                '2026-11-05',
                '2026-08-07',
            ]);
        });

        it('응답에 새 예정일이 없으면(과거 행만·빈 응답) 지우지 않는다', async () => {
            const { db, deleteFn } = makeDeleteDb();
            const repo = new DrizzleEarningsReportsRepository(db);

            await repo.pruneSupersededUpcoming(
                'COP',
                [
                    {
                        ...upcomingInput,
                        earningsDate: '2026-08-07',
                        epsActual: 1,
                    },
                ],
                '2026-10-22'
            );
            await repo.pruneSupersededUpcoming('COP', [], '2026-10-22');

            expect(deleteFn).not.toHaveBeenCalled();
        });
    });

    describe('DB transient retry wire-up', () => {
        it('transient 연결 에러(CONNECTION_CLOSED)가 발생하면 재시도해 결국 성공한다', async () => {
            const dbTransient = Object.assign(
                new Error('write CONNECTION_CLOSED db.example:5432'),
                { code: 'CONNECTION_CLOSED' }
            );
            const onConflictDoUpdate = vi
                .fn()
                .mockRejectedValueOnce(dbTransient)
                .mockResolvedValueOnce(undefined);
            const values = vi.fn(() => ({ onConflictDoUpdate }));
            const insert = vi.fn(() => ({ values }));
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
                { name: 'PostgresError', code: '23505' }
            );
            const onConflictDoUpdate = vi
                .fn()
                .mockRejectedValueOnce(constraintError);
            const values = vi.fn(() => ({ onConflictDoUpdate }));
            const insert = vi.fn(() => ({ values }));
            const db = { insert } as unknown as SiglensDatabase;
            const repo = new DrizzleEarningsReportsRepository(db);

            await expect(repo.upsertMany([reportInput])).rejects.toBe(
                constraintError
            );
            expect(insert).toHaveBeenCalledTimes(1);
        });
    });

    describe('toInsertRow null branches via upsertBatch', () => {
        it('handles all null numeric fields in upsert', async () => {
            const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
            const values = vi.fn(() => ({ onConflictDoUpdate }));
            const insert = vi.fn(() => ({ values }));
            const db = { insert } as unknown as SiglensDatabase;
            const repo = new DrizzleEarningsReportsRepository(db);

            const input: EarningsReportUpsertInput = {
                symbol: 'AAPL',
                earningsDate: '2025-08-01',
                epsActual: null,
                epsEstimated: null,
                revenueActual: null,
                revenueEstimated: null,
                lastUpdated: null,
                rawPayload: {},
            };

            await repo.upsertMany([input]);

            expect(values).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        epsActual: null,
                        epsEstimated: null,
                        revenueActual: null,
                        revenueEstimated: null,
                    }),
                ])
            );
        });
    });
});
