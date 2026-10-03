vi.mock('server-only', () => ({}));

import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DrizzlePlainTextRepository } from '@/entities/analysis-plain/plainTextRepository';
import type { SiglensDatabase } from '@/shared/db/types';

function makeFindDb(rows: unknown[]) {
    const limit = vi.fn().mockResolvedValue(rows);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    return {
        db: { select } as unknown as SiglensDatabase,
        spies: { select, from, where, limit },
    };
}

function makeInsertDb() {
    const onConflictDoNothing = vi.fn(async () => undefined);
    const values = vi.fn(() => ({ onConflictDoNothing }));
    const insert = vi.fn(() => ({ values }));
    return {
        db: { insert } as unknown as SiglensDatabase,
        spies: { insert, values, onConflictDoNothing },
    };
}

beforeEach(() => vi.clearAllMocks());

describe('DrizzlePlainTextRepository.find', () => {
    it('행이 있으면 text 컬럼만 돌려준다', async () => {
        const { db } = makeFindDb([{ text: '쉽게 쓴 분석문' }]);
        const repo = new DrizzlePlainTextRepository(db);
        await expect(repo.find('v14', 'ko', 'abc')).resolves.toBe(
            '쉽게 쓴 분석문'
        );
    });

    it('행이 없으면 null', async () => {
        const { db } = makeFindDb([]);
        const repo = new DrizzlePlainTextRepository(db);
        await expect(repo.find('v14', 'ko', 'abc')).resolves.toBeNull();
    });

    /**
     * 컬럼 이름 집합과 값 집합을 따로 보면 `prompt_version = 'ja'`처럼 짝이 바뀌어도
     * 통과한다. 실제 SQL로 컴파일해 컬럼 순서와 바인딩 파라미터 순서를 함께 고정한다.
     * 값을 서로 다르게 잡아 짝이 틀리면 반드시 걸린다.
     */
    it('복합 PK 세 열을 올바른 값과 짝지어 조건에 싣는다', async () => {
        const { db, spies } = makeFindDb([]);
        const repo = new DrizzlePlainTextRepository(db);
        await repo.find('v14', 'ja', 'deadbeef');

        const condition = (spies.where.mock.calls as unknown[][])[0][0] as SQL;
        const query = new PgDialect().sqlToQuery(condition);

        expect(query.sql).toMatch(
            /"prompt_version" = \$1 and .*"locale" = \$2 and .*"input_digest" = \$3/
        );
        expect(query.params).toEqual(['v14', 'ja', 'deadbeef']);
        expect(spies.limit).toHaveBeenCalledWith(1);
    });

    it('DB 오류는 삼키지 않고 전파한다 — 미스 취급은 호출자의 몫', async () => {
        const limit = vi.fn().mockRejectedValue(new Error('db down'));
        const db = {
            select: () => ({ from: () => ({ where: () => ({ limit }) }) }),
        } as unknown as SiglensDatabase;
        const repo = new DrizzlePlainTextRepository(db);
        await expect(repo.find('v14', 'ko', 'abc')).rejects.toThrow('db down');
    });
});

describe('DrizzlePlainTextRepository.insert', () => {
    it('인자를 컬럼 값에 올바르게 매핑해 한 번 insert한다', async () => {
        const { db, spies } = makeInsertDb();
        const repo = new DrizzlePlainTextRepository(db);
        await repo.insert('v14', 'ko', 'abc', '본문');

        expect(spies.insert).toHaveBeenCalledOnce();
        expect(spies.values).toHaveBeenCalledWith({
            promptVersion: 'v14',
            locale: 'ko',
            inputDigest: 'abc',
            text: '본문',
        });
    });

    it('ON CONFLICT DO NOTHING의 target이 복합 PK 세 열이다', async () => {
        const { db, spies } = makeInsertDb();
        const repo = new DrizzlePlainTextRepository(db);
        await repo.insert('v14', 'ko', 'abc', '본문');

        expect(spies.onConflictDoNothing).toHaveBeenCalledOnce();
        const { target } = (
            spies.onConflictDoNothing.mock.calls as unknown as Array<
                [{ target: Array<{ name: string }> }]
            >
        )[0][0];
        expect(target.map(column => column.name)).toEqual([
            'prompt_version',
            'locale',
            'input_digest',
        ]);
    });

    it('일시적 Neon 오류는 재시도해 성공시킨다', async () => {
        vi.useFakeTimers();
        try {
            const transient = Object.assign(
                new Error('Error connecting to database: fetch failed'),
                { name: 'NeonDbError' }
            );
            const onConflictDoNothing = vi
                .fn()
                .mockRejectedValueOnce(transient)
                .mockResolvedValue(undefined);
            const values = vi.fn(() => ({ onConflictDoNothing }));
            const db = {
                insert: () => ({ values }),
            } as unknown as SiglensDatabase;
            const repo = new DrizzlePlainTextRepository(db);

            const done = repo.insert('v14', 'ko', 'abc', '본문');
            await vi.advanceTimersByTimeAsync(5_000);
            await expect(done).resolves.toBeUndefined();
            expect(onConflictDoNothing).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });
});
