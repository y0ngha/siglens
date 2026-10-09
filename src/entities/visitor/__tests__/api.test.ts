import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import { DrizzleVisitorRepository } from '@/entities/visitor/api';
import { visitorDays } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';

function makeInsertDb(): {
    db: SiglensDatabase;
    values: ReturnType<typeof vi.fn>;
    onConflictDoUpdate: ReturnType<typeof vi.fn>;
} {
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));
    return {
        db: { insert } as unknown as SiglensDatabase,
        values,
        onConflictDoUpdate,
    };
}

function makeDeleteDb(): {
    db: SiglensDatabase;
    where: ReturnType<typeof vi.fn>;
} {
    const where = vi.fn().mockResolvedValue(undefined);
    const del = vi.fn(() => ({ where }));
    return { db: { delete: del } as unknown as SiglensDatabase, where };
}

/**
 * 네 가지 select 체인을 한 목으로 덮는다.
 *  - `dailyActiveUsers`: select().from().where().groupBy().orderBy()
 *  - `topUserAgents`:    select().from().where().groupBy().orderBy().limit()
 *  - `monthlyActiveUsers`: select().from().where()  ← where가 곧 thenable
 *  - `totalRows`: select().from()                    ← from이 곧 thenable
 *
 * 그래서 `from`·`where`·`orderBy`는 **객체이면서 동시에 await 가능**해야 한다.
 * `then`을 얹어 둘 다 만족시킨다.
 */
function thenableOf(rows: unknown[], extra: object): object {
    return {
        ...extra,
        then: (resolve: (value: unknown[]) => unknown) => resolve(rows),
    };
}

function makeSelectDb(rows: unknown[]): SiglensDatabase {
    const limit = vi.fn().mockResolvedValue(rows);
    // `dailyActiveUsers`는 orderBy에서 끝나고 `topUserAgents`는 limit까지 간다.
    // orderBy가 thenable이면서 limit도 들고 있어야 둘 다 덮인다.
    const orderBy = vi.fn(() => thenableOf(rows, { limit }));
    const groupBy = vi.fn(() => ({ orderBy }));
    const thenable = (extra: object) => thenableOf(rows, extra);
    const where = vi.fn(() => thenable({ groupBy }));
    const from = vi.fn(() => thenable({ where }));
    const select = vi.fn(() => ({ from }));
    return { select } as unknown as SiglensDatabase;
}

describe('DrizzleVisitorRepository', () => {
    it('recordVisit은 진단 컬럼과 user_id까지 담아 삽입한다', async () => {
        const { db, values } = makeInsertDb();
        const visit = {
            visitorHash: 'hash-1',
            date: '2026-09-02',
            userAgent: 'Mozilla/5.0 (Macintosh) Chrome/140.0.0.0',
            country: 'KR',
            landingPath: '/ko/AAPL',
            userId: 'user-1',
        };
        await new DrizzleVisitorRepository(db).recordVisit(visit);
        expect(values).toHaveBeenCalledWith(visit);
    });

    /**
     * 같은 날 익명으로 먼저 왔다가 로그인하면 행이 이미 있다. 그 행의 user_id만 채우고,
     * 한 번 채워진 값은 바꾸지 않는다(COALESCE) — 두 번째 테스트가 그 SQL을 고정한다.
     */
    it('recordVisit은 (date, visitor_hash) 충돌 시 user_id만 COALESCE로 채운다', async () => {
        const { db, onConflictDoUpdate } = makeInsertDb();
        await new DrizzleVisitorRepository(db).recordVisit({
            visitorHash: 'hash-1',
            date: '2026-09-02',
            userAgent: null,
            country: null,
            landingPath: null,
            userId: null,
        });
        expect(onConflictDoUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                target: [visitorDays.date, visitorDays.visitorHash],
            })
        );
        const [{ set, setWhere }] = onConflictDoUpdate.mock.calls.find(
            ([arg]) => arg !== undefined
        ) as [{ set: { userId: unknown }; setWhere: never }];
        expect(Object.keys(set)).toEqual(['userId']);
        const rendered = new PgDialect().sqlToQuery(set.userId as never);
        expect(rendered.sql).toBe(
            'coalesce("visitor_days"."user_id", excluded.user_id)'
        );
        // 채울 때만 쓴다: 기존 user_id가 비어 있고 들어온 값이 있을 때.
        expect(new PgDialect().sqlToQuery(setWhere).sql).toBe(
            '("visitor_days"."user_id" is null and excluded.user_id is not null)'
        );
    });

    it('pruneOlderThan은 삭제를 한 번 건다', async () => {
        const { db, where } = makeDeleteDb();
        await new DrizzleVisitorRepository(db).pruneOlderThan('2025-07-29');
        expect(where).toHaveBeenCalledTimes(1);
    });

    it('monthlyActiveUsers는 행이 없으면 0을 준다', async () => {
        const repo = new DrizzleVisitorRepository(makeSelectDb([]));
        await expect(repo.monthlyActiveUsers('2026-08-03')).resolves.toBe(0);
    });

    it('monthlyActiveUsers는 distinct 집계값을 꺼낸다', async () => {
        const repo = new DrizzleVisitorRepository(
            makeSelectDb([{ value: 1847 }])
        );
        await expect(repo.monthlyActiveUsers('2026-08-03')).resolves.toBe(1847);
    });

    it('totalRows는 행이 없으면 0을 준다', async () => {
        const repo = new DrizzleVisitorRepository(makeSelectDb([]));
        await expect(repo.totalRows()).resolves.toBe(0);
    });

    it('topUserAgents는 상위 UA 행을 그대로 돌려준다', async () => {
        const rows = [
            { userAgent: 'Mozilla/5.0 Chrome/140', country: 'KR', count: 91 },
            { userAgent: null, country: null, count: 3 },
        ];
        const repo = new DrizzleVisitorRepository(makeSelectDb(rows));
        await expect(repo.topUserAgents('2026-08-03', 30)).resolves.toEqual(
            rows
        );
    });

    it('dailyActiveUsers는 날짜별 행을 그대로 돌려준다', async () => {
        const rows = [
            { date: '2026-09-02', count: 142 },
            { date: '2026-09-01', count: 118 },
        ];
        const repo = new DrizzleVisitorRepository(makeSelectDb(rows));
        await expect(repo.dailyActiveUsers('2026-08-03')).resolves.toEqual(
            rows
        );
    });
});
