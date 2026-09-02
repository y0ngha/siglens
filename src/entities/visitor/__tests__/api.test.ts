import { describe, expect, it, vi } from 'vitest';
import { DrizzleVisitorRepository } from '@/entities/visitor/api';
import type { SiglensDatabase } from '@/shared/db/types';

function makeInsertDb(): {
    db: SiglensDatabase;
    values: ReturnType<typeof vi.fn>;
    onConflictDoNothing: ReturnType<typeof vi.fn>;
} {
    const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn(() => ({ onConflictDoNothing }));
    const insert = vi.fn(() => ({ values }));
    return {
        db: { insert } as unknown as SiglensDatabase,
        values,
        onConflictDoNothing,
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
 * 세 가지 select 체인을 한 목으로 덮는다.
 *  - `dailyActiveUsers`: select().from().where().groupBy().orderBy()
 *  - `monthlyActiveUsers`: select().from().where()  ← where가 곧 thenable
 *  - `totalRows`: select().from()                    ← from이 곧 thenable
 *
 * 그래서 `from`과 `where`는 **객체이면서 동시에 await 가능**해야 한다.
 * `then`을 얹어 둘 다 만족시킨다.
 */
function makeSelectDb(rows: unknown[]): SiglensDatabase {
    const orderBy = vi.fn().mockResolvedValue(rows);
    const groupBy = vi.fn(() => ({ orderBy }));
    const thenable = (extra: object) => ({
        ...extra,
        then: (resolve: (value: unknown[]) => unknown) => resolve(rows),
    });
    const where = vi.fn(() => thenable({ groupBy }));
    const from = vi.fn(() => thenable({ where }));
    const select = vi.fn(() => ({ from }));
    return { select } as unknown as SiglensDatabase;
}

describe('DrizzleVisitorRepository', () => {
    it('recordVisit은 중복을 무시하고 삽입한다', async () => {
        const { db, values, onConflictDoNothing } = makeInsertDb();
        await new DrizzleVisitorRepository(db).recordVisit(
            'hash-1',
            '2026-09-02'
        );

        expect(values).toHaveBeenCalledWith({
            visitorHash: 'hash-1',
            date: '2026-09-02',
        });
        // 같은 방문자가 하루에 여러 번 와도 행은 하나여야 한다.
        expect(onConflictDoNothing).toHaveBeenCalledTimes(1);
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
