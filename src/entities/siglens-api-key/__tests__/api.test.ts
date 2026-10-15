vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { DrizzleSiglensApiKeyRepository } from '@/entities/siglens-api-key/api';
import type { SiglensDatabase } from '@/shared/db/types';

const dialect = new PgDialect();
/** 실제 쿼리로 렌더한 SQL과 바인딩 값 — 호출 횟수가 아니라 조건의 모양을 단언하려고 쓴다. */
const render = (condition: unknown): { sql: string; params: unknown[] } =>
    dialect.sqlToQuery(condition as SQL);

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const KEY_ID = '33333333-3333-4333-8333-333333333333';
const HASH = 'a'.repeat(64);
const createdAt = new Date('2026-10-01T00:00:00.000Z');

const summary = {
    id: KEY_ID,
    name: '내 에이전트',
    keyPrefix: 'slk_ab12cd',
    createdAt,
    lastUsedAt: null,
};

describe('listActiveByUser', () => {
    it('본인의 폐기되지 않은 키만 오래된 순으로 읽는다', async () => {
        const orderBy = vi.fn().mockResolvedValue([summary]);
        const where = vi.fn(() => ({ orderBy }));
        const from = vi.fn(() => ({ where }));
        const db = { select: vi.fn(() => ({ from })) };
        const repo = new DrizzleSiglensApiKeyRepository(
            db as unknown as SiglensDatabase
        );

        await expect(repo.listActiveByUser(OWNER)).resolves.toEqual([summary]);

        const { sql, params } = render(
            (where.mock.calls as unknown[][]).find(call => call.length > 0)?.[0]
        );
        expect(sql).toContain('"user_id" = $1');
        expect(sql).toContain('"revoked_at" is null');
        expect(params).toEqual([OWNER]);
    });

    it('조회 결과에 해시를 싣지 않는다', async () => {
        const select = vi.fn(() => ({
            from: () => ({
                where: () => ({ orderBy: () => Promise.resolve([]) }),
            }),
        }));
        const repo = new DrizzleSiglensApiKeyRepository({
            select,
        } as unknown as SiglensDatabase);
        await repo.listActiveByUser(OWNER);
        const columns = Object.keys(
            (select.mock.calls as unknown[][])[0][0] as object
        );
        expect(columns).toEqual([
            'id',
            'name',
            'keyPrefix',
            'createdAt',
            'lastUsedAt',
        ]);
    });
});

interface TxFixture {
    db: SiglensDatabase;
    insertValues: ReturnType<typeof vi.fn>;
    lockWhere: ReturnType<typeof vi.fn>;
    countWhere: ReturnType<typeof vi.fn>;
    forClause: ReturnType<typeof vi.fn>;
}

function makeTxDb(activeCount: number, inserted: unknown[]): TxFixture {
    const forClause = vi.fn().mockResolvedValue([{ id: OWNER }]);
    const lockWhere = vi.fn(() => ({ for: forClause }));
    const countWhere = vi.fn().mockResolvedValue([{ value: activeCount }]);
    const select = vi
        .fn()
        .mockReturnValueOnce({ from: () => ({ where: lockWhere }) })
        .mockReturnValueOnce({ from: () => ({ where: countWhere }) });
    const returning = vi.fn().mockResolvedValue(inserted);
    const insertValues = vi.fn(() => ({ returning }));
    const tx = { select, insert: vi.fn(() => ({ values: insertValues })) };
    const db = {
        transaction: vi.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    return {
        db: db as unknown as SiglensDatabase,
        insertValues,
        lockWhere,
        countWhere,
        forClause,
    };
}

const input = {
    userId: OWNER,
    name: '내 에이전트',
    keyPrefix: 'slk_ab12cd',
    keyHash: HASH,
};

describe('createWithinLimit', () => {
    it('상한 미만이면 삽입하고 요약을 돌려준다', async () => {
        const fx = makeTxDb(4, [summary]);
        const repo = new DrizzleSiglensApiKeyRepository(fx.db);
        await expect(repo.createWithinLimit(input, 5)).resolves.toEqual({
            status: 'created',
            key: summary,
        });
        expect(fx.insertValues).toHaveBeenCalledWith(input);
    });

    it('활성 키가 상한이면 삽입하지 않고 limit_reached', async () => {
        const fx = makeTxDb(5, [summary]);
        const repo = new DrizzleSiglensApiKeyRepository(fx.db);
        await expect(repo.createWithinLimit(input, 5)).resolves.toEqual({
            status: 'limit_reached',
        });
        expect(fx.insertValues).not.toHaveBeenCalled();
    });

    it('개수는 폐기되지 않은 본인 키만 센다', async () => {
        const fx = makeTxDb(0, [summary]);
        await new DrizzleSiglensApiKeyRepository(fx.db).createWithinLimit(
            input,
            5
        );
        const { sql, params } = render(
            (fx.countWhere.mock.calls as unknown[][])[0][0]
        );
        expect(sql).toContain('"user_id" = $1');
        expect(sql).toContain('"revoked_at" is null');
        expect(params).toEqual([OWNER]);
    });

    it('개수 확인 전에 소유 회원 행을 잠근다(경합 방지)', async () => {
        const fx = makeTxDb(0, [summary]);
        await new DrizzleSiglensApiKeyRepository(fx.db).createWithinLimit(
            input,
            5
        );
        expect(fx.forClause).toHaveBeenCalledWith('no key update');
        expect(
            render((fx.lockWhere.mock.calls as unknown[][])[0][0]).params
        ).toEqual([OWNER]);
    });

    it('삽입 결과가 없으면 던진다', async () => {
        const fx = makeTxDb(0, []);
        await expect(
            new DrizzleSiglensApiKeyRepository(fx.db).createWithinLimit(
                input,
                5
            )
        ).rejects.toThrow('Failed to insert siglens API key');
    });
});

describe('revokeOwned', () => {
    function makeUpdateDb(rows: unknown[]) {
        const returning = vi.fn().mockResolvedValue(rows);
        const where = vi.fn(() => ({ returning }));
        const set = vi.fn((_values: object) => ({ where }));
        const db = { update: vi.fn(() => ({ set })) };
        return { db: db as unknown as SiglensDatabase, set, where };
    }

    it('폐기하고 캐시 무효화용 해시를 돌려준다', async () => {
        const { db, set } = makeUpdateDb([{ keyHash: HASH }]);
        await expect(
            new DrizzleSiglensApiKeyRepository(db).revokeOwned(OWNER, KEY_ID)
        ).resolves.toEqual({ status: 'revoked', keyHash: HASH });
        expect(Object.keys(set.mock.calls[0][0] as object)).toEqual([
            'revokedAt',
        ]);
    });

    it('WHERE에 키 id·소유자·미폐기 조건이 모두 있다(남의 키를 못 지운다)', async () => {
        const { db, where } = makeUpdateDb([]);
        await new DrizzleSiglensApiKeyRepository(db).revokeOwned(OTHER, KEY_ID);
        const { sql, params } = render((where.mock.calls as unknown[][])[0][0]);
        expect(sql).toContain('"id" = $1');
        expect(sql).toContain('"user_id" = $2');
        expect(sql).toContain('"revoked_at" is null');
        expect(params).toEqual([KEY_ID, OTHER]);
    });

    it('대상이 없거나 이미 폐기됐으면 not_found', async () => {
        const { db } = makeUpdateDb([]);
        await expect(
            new DrizzleSiglensApiKeyRepository(db).revokeOwned(OWNER, KEY_ID)
        ).resolves.toEqual({ status: 'not_found' });
    });
});

describe('findActivePrincipalByHash', () => {
    function makeJoinDb(rows: unknown[]) {
        const limit = vi.fn().mockResolvedValue(rows);
        const where = vi.fn(() => ({ limit }));
        const innerJoin = vi.fn(() => ({ where }));
        const from = vi.fn(() => ({ innerJoin }));
        const select = vi.fn(() => ({ from }));
        return {
            db: { select } as unknown as SiglensDatabase,
            where,
            select,
        };
    }

    it('해시로 활성·인증 완료 회원의 키만 조회한다', async () => {
        const { db, where } = makeJoinDb([]);
        await new DrizzleSiglensApiKeyRepository(db).findActivePrincipalByHash(
            HASH
        );
        const { sql, params } = render((where.mock.calls as unknown[][])[0][0]);
        expect(sql).toContain('"key_hash" = $1');
        expect(sql).toContain('"revoked_at" is null');
        expect(sql).toContain('"email_verified" = $2');
        expect(params).toEqual([HASH, true]);
    });

    it('행이 있으면 principal 필드를 그대로 돌려준다', async () => {
        const row = {
            keyId: KEY_ID,
            keyName: '내 에이전트',
            keyPrefix: 'slk_ab12cd',
            userId: OWNER,
            tier: 'pro',
        };
        const { db } = makeJoinDb([row]);
        await expect(
            new DrizzleSiglensApiKeyRepository(db).findActivePrincipalByHash(
                HASH
            )
        ).resolves.toEqual(row);
    });

    it('행이 없으면 null', async () => {
        const { db } = makeJoinDb([]);
        await expect(
            new DrizzleSiglensApiKeyRepository(db).findActivePrincipalByHash(
                HASH
            )
        ).resolves.toBeNull();
    });
});

describe('touchLastUsed', () => {
    it('갱신 간격 조건을 WHERE에 둬서 잦은 호출이 쓰기를 늘리지 않는다', async () => {
        const where = vi.fn().mockResolvedValue(undefined);
        const set = vi.fn(() => ({ where }));
        const db = { update: vi.fn(() => ({ set })) };
        await new DrizzleSiglensApiKeyRepository(
            db as unknown as SiglensDatabase
        ).touchLastUsed(KEY_ID);
        const { sql, params } = render((where.mock.calls as unknown[][])[0][0]);
        expect(sql).toContain('"last_used_at" IS NULL');
        expect(sql).toContain('make_interval');
        expect(params).toEqual([KEY_ID, 60]);
    });
});

describe('listActiveKeyHashesByUser', () => {
    it('본인의 미폐기 키 해시만 읽는다', async () => {
        const where = vi.fn().mockResolvedValue([{ keyHash: HASH }]);
        const select = vi.fn(() => ({ from: () => ({ where }) }));
        const repo = new DrizzleSiglensApiKeyRepository({
            select,
        } as unknown as SiglensDatabase);
        await expect(repo.listActiveKeyHashesByUser(OWNER)).resolves.toEqual([
            HASH,
        ]);
        expect(
            Object.keys((select.mock.calls as unknown[][])[0][0] as object)
        ).toEqual(['keyHash']);
        const { sql, params } = render((where.mock.calls as unknown[][])[0][0]);
        expect(sql).toContain('"user_id" = $1');
        expect(sql).toContain('"revoked_at" is null');
        expect(params).toEqual([OWNER]);
    });
});
