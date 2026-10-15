vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { DrizzleSiglensApiKeyRepository } from '@/entities/siglens-api-key/api';
import type { SiglensDatabase } from '@/shared/db/types';

const dialect = new PgDialect();
const render = (condition: unknown): { sql: string; params: unknown[] } =>
    dialect.sqlToQuery(condition as SQL);

const OWNER = '11111111-1111-4111-8111-111111111111';

describe('findApiDefaultModel', () => {
    function makeSelectDb(rows: unknown[]) {
        const limit = vi.fn().mockResolvedValue(rows);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        const select = vi.fn((_columns: object) => ({ from }));
        return {
            db: { select } as unknown as SiglensDatabase,
            select,
            where,
        };
    }

    it('회원 id로만 읽고 api_default_model 컬럼 하나만 가져온다', async () => {
        const fx = makeSelectDb([{ model: 'claude-opus-5' }]);
        const repo = new DrizzleSiglensApiKeyRepository(fx.db);

        await expect(repo.findApiDefaultModel(OWNER)).resolves.toBe(
            'claude-opus-5'
        );

        expect(Object.keys(fx.select.mock.calls[0][0])).toEqual(['model']);
        const { sql, params } = render(
            (fx.where.mock.calls as unknown[][])[0][0]
        );
        expect(sql).toContain('"id" = $1');
        expect(params).toEqual([OWNER]);
    });

    it.each([
        ['설정 안 함(null)', [{ model: null }]],
        ['회원 행 없음', []],
    ])('%s이면 null', async (_label, rows) => {
        const repo = new DrizzleSiglensApiKeyRepository(makeSelectDb(rows).db);
        await expect(repo.findApiDefaultModel(OWNER)).resolves.toBeNull();
    });
});

describe('setApiDefaultModel', () => {
    function makeUpdateDb(returned: unknown[]) {
        const returning = vi.fn().mockResolvedValue(returned);
        const where = vi.fn(() => ({ returning }));
        const set = vi.fn(() => ({ where }));
        const update = vi.fn(() => ({ set }));
        return {
            db: { update } as unknown as SiglensDatabase,
            set,
            where,
        };
    }

    it('본인 행의 api_default_model만 바꾼다', async () => {
        const fx = makeUpdateDb([{ id: OWNER }]);
        const repo = new DrizzleSiglensApiKeyRepository(fx.db);

        await expect(
            repo.setApiDefaultModel(OWNER, 'gpt-6-astra')
        ).resolves.toBe(true);

        expect(fx.set).toHaveBeenCalledWith({
            apiDefaultModel: 'gpt-6-astra',
        });
        const { sql, params } = render(
            (fx.where.mock.calls as unknown[][])[0][0]
        );
        expect(sql).toContain('"id" = $1');
        expect(params).toEqual([OWNER]);
    });

    it('null은 설정 해제', async () => {
        const fx = makeUpdateDb([{ id: OWNER }]);
        await new DrizzleSiglensApiKeyRepository(fx.db).setApiDefaultModel(
            OWNER,
            null
        );
        expect(fx.set).toHaveBeenCalledWith({ apiDefaultModel: null });
    });

    it('회원 행이 없으면 false', async () => {
        const repo = new DrizzleSiglensApiKeyRepository(makeUpdateDb([]).db);
        await expect(repo.setApiDefaultModel(OWNER, null)).resolves.toBe(false);
    });
});
