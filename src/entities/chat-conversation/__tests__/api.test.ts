import { describe, expect, it, vi } from 'vitest';
vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));
import { DrizzleChatConversationRepository } from '@/entities/chat-conversation/api';
import { CONVERSATION_LIST_LIMIT } from '@/entities/chat-conversation/model';
import type { SiglensDatabase } from '@/shared/db/types';

const VALID_ID = '11111111-1111-1111-1111-111111111111';
const VALID_USER = '22222222-2222-2222-2222-222222222222';

/**
 * A `NeonDbError`-shaped transient error — matches `isNeonTransientError`'s
 * classification exactly (name check + `TRANSIENT_MESSAGE_NEEDLES` includes
 * `'fetch failed'`). A plain `new Error('boom')` is NOT retryable, so tests
 * asserting "not retried" must use this shape — otherwise the assertion
 * passes for the wrong reason (the error was never eligible for retry in
 * the first place) and can't catch a regression that re-adds retry.
 */
function transientError(): Error {
    return Object.assign(new Error('fetch failed'), { name: 'NeonDbError' });
}

/** Chainable drizzle stub: every builder method returns the same object; awaiting yields `result`. */
function chain<T>(result: T) {
    const obj: Record<string, unknown> = {};
    for (const m of [
        'select',
        'from',
        'where',
        'orderBy',
        'limit',
        'insert',
        'values',
        'update',
        'set',
        'delete',
    ])
        obj[m] = vi.fn(() => obj);
    obj.returning = vi.fn().mockResolvedValue(result);
    obj.then = (resolve: (v: T) => void, reject?: (e: unknown) => void) =>
        Promise.resolve(result).then(resolve, reject);
    return obj;
}

/**
 * Wraps a real Drizzle instance so every terminal `await` on a query
 * builder is intercepted just before it would hit the (nonexistent) driver:
 * it records `.toSQL()` and resolves with `[]` instead of executing.
 *
 * This lets tests assert the *actual generated SQL/params* produced by
 * production code — not a hand-copied condition list that can drift from
 * what Drizzle really builds (see `entities/seo-snapshot/__tests__/upsertSql.test.ts`
 * for the same pattern; that file is the reference for why a raw `.toSQL()`
 * on the real query is required instead of asserting on `values()` call args).
 */
function withSqlCapture(
    captured: { sql: string; params: unknown[] }[]
): (real: unknown) => unknown {
    function wrap(target: unknown): unknown {
        if (target === null || typeof target !== 'object') return target;
        return new Proxy(target as object, {
            get(t, prop) {
                if (
                    prop === 'then' &&
                    typeof (t as { toSQL?: unknown }).toSQL === 'function'
                ) {
                    return (resolve: (v: unknown) => void) => {
                        const q = (
                            t as {
                                toSQL: () => { sql: string; params: unknown[] };
                            }
                        ).toSQL();
                        captured.push(q);
                        resolve([]);
                        return Promise.resolve();
                    };
                }
                const value = Reflect.get(t, prop, t);
                if (typeof value === 'function') {
                    return (...args: unknown[]) => wrap(value.apply(t, args));
                }
                return value;
            },
        });
    }
    return wrap;
}

async function realDbWithCapture() {
    const captured: { sql: string; params: unknown[] }[] = [];
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const schema = await import('@/shared/db/schema');
    // `drizzle.mock()` builds queries with no client at all — unlike
    // `drizzle({} as never, ...)`, it never touches PG* env vars to
    // construct a (never-used) real postgres-js client.
    const real = drizzle.mock({ schema });
    const db = withSqlCapture(captured)(real) as unknown as SiglensDatabase;
    return { db, captured };
}

/**
 * Returns the SQL text *after* the first `where` keyword, lower-cased. Used
 * so ownership assertions can't pass vacuously off a column that merely
 * appears in the SELECT list (e.g. `"user_id"` is always present in
 * `select "id", "user_id", ... from ...` regardless of whether the WHERE
 * clause actually filters by it).
 */
function whereOnly(sql: string): string {
    const lower = sql.toLowerCase();
    const idx = lower.indexOf(' where ');
    expect(idx).toBeGreaterThanOrEqual(0);
    return lower.slice(idx + ' where '.length);
}

describe('DrizzleChatConversationRepository — generated SQL', () => {
    it('appendMessages: seq는 coalesce(max(seq),0) + n, 순서대로 파라미터 1,2', async () => {
        const { db, captured } = await realDbWithCapture();
        const repo = new DrizzleChatConversationRepository(db);
        await repo.appendMessages(VALID_ID, [
            { role: 'user', content: 'q' },
            { role: 'assistant', content: 'a' },
        ]);
        // captured[0] = INSERT, captured[1] = counter UPDATE
        expect(captured).toHaveLength(2);
        const insertSql = captured[0]!.sql.toLowerCase();
        expect(insertSql).toContain('coalesce(max(');
        expect(insertSql).toContain(', 0)');
        // 두 행 각각 "+ n" 표현식이 한 번씩 나온다(파라미터로 1, 2가 순서대로 들어감).
        expect(captured[0]!.params).toContain(1);
        expect(captured[0]!.params).toContain(2);
        const oneIndex = captured[0]!.params.indexOf(1);
        const twoIndex = captured[0]!.params.indexOf(2);
        expect(oneIndex).toBeLessThan(twoIndex);
    });

    it('appendMessages: 카운터 갱신은 count(*) 재계산(증분 아님)', async () => {
        const { db, captured } = await realDbWithCapture();
        const repo = new DrizzleChatConversationRepository(db);
        await repo.appendMessages(VALID_ID, [{ role: 'user', content: 'q' }]);
        const counterSql = captured[1]!.sql.toLowerCase();
        expect(counterSql).toContain('count(*)');
        expect(counterSql).not.toContain('message_count" +');
        // The subquery has its own `where`; the outer scope is after the LAST one.
        const outerWhere = counterSql.slice(counterSql.lastIndexOf(' where '));
        expect(outerWhere).toContain('"chat_conversations"."id" = $');
        expect(captured[1]!.params).toContain(VALID_ID);
    });

    it('appendMessages([]) → [], DB 호출 없음', async () => {
        const { db, captured } = await realDbWithCapture();
        const repo = new DrizzleChatConversationRepository(db);
        expect(await repo.appendMessages(VALID_ID, [])).toEqual([]);
        expect(captured).toHaveLength(0);
    });

    it('findForUser: WHERE에 id/user_id/deleted_at is null 조건이 전부 있고 파라미터에 값이 들어간다', async () => {
        const { db, captured } = await realDbWithCapture();
        const repo = new DrizzleChatConversationRepository(db);
        await repo.findForUser(VALID_ID, VALID_USER);
        const where = whereOnly(captured[0]!.sql);
        expect(where).toContain('"chat_conversations"."id" = $');
        expect(where).toContain('"chat_conversations"."user_id" = $');
        expect(where).toContain('"chat_conversations"."deleted_at" is null');
        expect(captured[0]!.params).toContain(VALID_ID);
        expect(captured[0]!.params).toContain(VALID_USER);
    });

    it('listForUser: WHERE에 user_id/deleted_at is null이 있다(id 조건 없음)', async () => {
        const { db, captured } = await realDbWithCapture();
        const repo = new DrizzleChatConversationRepository(db);
        await repo.listForUser(VALID_USER);
        const where = whereOnly(captured[0]!.sql);
        expect(where).toContain('"chat_conversations"."user_id" = $');
        expect(where).toContain('"chat_conversations"."deleted_at" is null');
        expect(captured[0]!.params).toContain(VALID_USER);
    });

    it('countForUser: WHERE에 user_id/deleted_at is null이 있다', async () => {
        const { db, captured } = await realDbWithCapture();
        const repo = new DrizzleChatConversationRepository(db);
        await repo.countForUser(VALID_USER);
        const where = whereOnly(captured[0]!.sql);
        expect(where).toContain('"chat_conversations"."user_id" = $');
        expect(where).toContain('"chat_conversations"."deleted_at" is null');
        expect(captured[0]!.params).toContain(VALID_USER);
    });

    it.each([
        [
            'rename',
            (repo: DrizzleChatConversationRepository) =>
                repo.rename(VALID_ID, VALID_USER, 't'),
        ],
        [
            'softDelete',
            (repo: DrizzleChatConversationRepository) =>
                repo.softDelete(VALID_ID, VALID_USER),
        ],
    ])(
        '%s: WHERE에 user_id/deleted_at is null이 있다(소프트 삭제된 행은 재조작 불가)',
        async (_name, call) => {
            const { db, captured } = await realDbWithCapture();
            const repo = new DrizzleChatConversationRepository(db);
            await call(repo);
            const where = whereOnly(captured[0]!.sql);
            expect(where).toContain('"chat_conversations"."user_id" = $');
            expect(where).toContain(
                '"chat_conversations"."deleted_at" is null'
            );
            expect(captured[0]!.params).toContain(VALID_USER);
        }
    );

    it('listForUser: LIMIT은 CONVERSATION_LIST_LIMIT(300) 기본값', async () => {
        const { db, captured } = await realDbWithCapture();
        const repo = new DrizzleChatConversationRepository(db);
        await repo.listForUser(VALID_USER);
        expect(captured[0]!.params).toContain(CONVERSATION_LIST_LIMIT);
    });

    it('deleteFromSeq: 카운터 갱신도 count(*) 재계산(별도 SELECT 없음)', async () => {
        const { db, captured } = await realDbWithCapture();
        const repo = new DrizzleChatConversationRepository(db);
        await repo.deleteFromSeq(VALID_ID, 3);
        // DELETE, then a single counter UPDATE — no intermediate SELECT.
        expect(captured).toHaveLength(2);
        const counterSql = captured[1]!.sql.toLowerCase();
        expect(counterSql).toContain('update');
        expect(counterSql).toContain('count(*)');
        // The subquery has its own `where`; the outer scope is after the LAST one.
        const outerWhere = counterSql.slice(counterSql.lastIndexOf(' where '));
        expect(outerWhere).toContain('"chat_conversations"."id" = $');
        expect(captured[1]!.params).toContain(VALID_ID);
    });
});

describe('DrizzleChatConversationRepository — invalid UUID guard', () => {
    it('findForUser: UUID가 아니면 쿼리 없이 null', async () => {
        const db = chain([]);
        const repo = new DrizzleChatConversationRepository(
            db as unknown as SiglensDatabase
        );
        expect(await repo.findForUser('not-a-uuid', VALID_USER)).toBeNull();
        expect(db.select).not.toHaveBeenCalled();
    });

    it('rename/softDelete: UUID가 아니면 쿼리 없이 no-op', async () => {
        const db = chain([]);
        const repo = new DrizzleChatConversationRepository(
            db as unknown as SiglensDatabase
        );
        await repo.rename('not-a-uuid', VALID_USER, 't');
        await repo.softDelete('not-a-uuid', VALID_USER);
        expect(db.update).not.toHaveBeenCalled();
    });

    it('listMessages: UUID가 아니면 쿼리 없이 []', async () => {
        const db = chain([]);
        const repo = new DrizzleChatConversationRepository(
            db as unknown as SiglensDatabase
        );
        expect(await repo.listMessages('not-a-uuid')).toEqual([]);
        expect(db.select).not.toHaveBeenCalled();
    });

    it('appendMessages: UUID가 아니면 쿼리 없이 []', async () => {
        const db = chain([]);
        const repo = new DrizzleChatConversationRepository(
            db as unknown as SiglensDatabase
        );
        expect(
            await repo.appendMessages('not-a-uuid', [
                { role: 'user', content: 'q' },
            ])
        ).toEqual([]);
        expect(db.insert).not.toHaveBeenCalled();
    });

    it('supersedeAfterLastUser: UUID가 아니면 쿼리 없이 null', async () => {
        const db = chain([]);
        const repo = new DrizzleChatConversationRepository(
            db as unknown as SiglensDatabase
        );
        expect(await repo.supersedeAfterLastUser('not-a-uuid')).toBeNull();
        expect(db.select).not.toHaveBeenCalled();
    });

    it('deleteFromSeq: UUID가 아니면 쿼리 없이 no-op', async () => {
        const db = chain([]);
        const repo = new DrizzleChatConversationRepository(
            db as unknown as SiglensDatabase
        );
        await repo.deleteFromSeq('not-a-uuid', 1);
        expect(db.delete).not.toHaveBeenCalled();
    });

    it('deleteFromSeq: 대문자 UUID는 유효하다', async () => {
        const db = chain([]);
        const repo = new DrizzleChatConversationRepository(
            db as unknown as SiglensDatabase
        );
        await repo.deleteFromSeq(VALID_ID.toUpperCase(), 1);
        expect(db.delete).toHaveBeenCalledTimes(1);
    });

    it('deleteFromSeq: 공백이 섞인 UUID는 무효하다', async () => {
        const db = chain([]);
        const repo = new DrizzleChatConversationRepository(
            db as unknown as SiglensDatabase
        );
        await repo.deleteFromSeq(` ${VALID_ID} `, 1);
        expect(db.delete).not.toHaveBeenCalled();
    });
});

describe('DrizzleChatConversationRepository — retry policy', () => {
    it('create의 INSERT 실패는 재시도하지 않는다(비-멱등) — Neon 일시 오류라도', async () => {
        const db: Record<string, unknown> = {};
        let insertCalls = 0;
        db.insert = vi.fn(() => {
            insertCalls += 1;
            return db;
        });
        db.values = vi.fn(() => db);
        db.returning = vi.fn().mockRejectedValue(transientError());
        const repo = new DrizzleChatConversationRepository(
            db as unknown as SiglensDatabase
        );
        await expect(
            repo.create({
                userId: VALID_USER,
                firstMessage: 'hi',
                locale: 'ko',
                modelId: 'm',
            })
        ).rejects.toThrow('fetch failed');
        expect(insertCalls).toBe(1);
    });

    it('appendMessages의 INSERT 실패는 재시도하지 않는다(비-멱등) — Neon 일시 오류라도', async () => {
        const db: Record<string, unknown> = {};
        let insertCalls = 0;
        db.insert = vi.fn(() => {
            insertCalls += 1;
            return db;
        });
        db.values = vi.fn(() => db);
        db.returning = vi.fn().mockRejectedValue(transientError());
        const repo = new DrizzleChatConversationRepository(
            db as unknown as SiglensDatabase
        );
        await expect(
            repo.appendMessages(VALID_ID, [{ role: 'user', content: 'q' }])
        ).rejects.toThrow('fetch failed');
        expect(insertCalls).toBe(1);
    });

    it('appendMessages의 카운터 UPDATE는 일시 오류를 재시도해서 성공한다', async () => {
        const db: Record<string, unknown> = {};
        db.insert = vi.fn(() => db);
        db.values = vi.fn(() => db);
        db.returning = vi.fn().mockResolvedValue([{ id: 'm1', seq: 1 }]);
        db.update = vi.fn(() => db);
        db.set = vi.fn(() => db);
        const whereMock = vi
            .fn()
            .mockRejectedValueOnce(transientError())
            .mockResolvedValueOnce(undefined);
        db.where = whereMock;
        const repo = new DrizzleChatConversationRepository(
            db as unknown as SiglensDatabase
        );
        const saved = await repo.appendMessages(VALID_ID, [
            { role: 'user', content: 'q' },
        ]);
        expect(saved).toEqual([{ id: 'm1', seq: 1 }]);
        expect(whereMock).toHaveBeenCalledTimes(2);
    });

    it('appendMessages의 카운터 UPDATE가 재시도 후에도 실패하면 로그만 남기고 inserted 행을 반환한다', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        try {
            const db: Record<string, unknown> = {};
            db.insert = vi.fn(() => db);
            db.values = vi.fn(() => db);
            db.returning = vi.fn().mockResolvedValue([{ id: 'm1', seq: 1 }]);
            db.update = vi.fn(() => db);
            db.set = vi.fn(() => db);
            // Non-transient — withRetry re-throws immediately without retrying.
            db.where = vi.fn(() =>
                Promise.reject(new Error('constraint violation'))
            );
            const repo = new DrizzleChatConversationRepository(
                db as unknown as SiglensDatabase
            );
            const saved = await repo.appendMessages(VALID_ID, [
                { role: 'user', content: 'q' },
            ]);
            expect(saved).toEqual([{ id: 'm1', seq: 1 }]);
            expect(errorSpy).toHaveBeenCalled();
        } finally {
            errorSpy.mockRestore();
        }
    });
});

describe('DrizzleChatConversationRepository — behavior (chain stub)', () => {
    it('create는 제목을 60자로 자른다', async () => {
        const row = {
            id: VALID_ID,
            userId: VALID_USER,
            title: 'x'.repeat(60) + '…',
        };
        const db = chain([row]);
        const repo = new DrizzleChatConversationRepository(
            db as unknown as SiglensDatabase
        );
        expect(
            (
                await repo.create({
                    userId: VALID_USER,
                    firstMessage: 'x'.repeat(200),
                    locale: 'ko',
                    modelId: 'deepseek-v4.1-flash',
                })
            ).id
        ).toBe(VALID_ID);
        expect(
            (db.values as ReturnType<typeof vi.fn>).mock.lastCall![0]
        ).toMatchObject({
            title: 'x'.repeat(60) + '…',
            userId: VALID_USER,
        });
    });

    it('appendMessages는 저장된 행을 seq 순으로 반환하고 messageCount를 갱신한다', async () => {
        const db = chain([
            { id: 'm1', seq: 4 },
            { id: 'm2', seq: 5 },
        ]);
        const repo = new DrizzleChatConversationRepository(
            db as unknown as SiglensDatabase
        );
        const saved = await repo.appendMessages(VALID_ID, [
            { role: 'user', content: 'q' },
            { role: 'assistant', content: 'a', modelId: 'deepseek-v4.1-flash' },
        ]);
        expect(saved.map(r => r.seq)).toEqual([4, 5]);
        const rows = (db.values as ReturnType<typeof vi.fn>).mock.calls.find(
            call => Array.isArray(call[0]) && call[0][0]?.role === 'user'
        )?.[0] as Array<Record<string, unknown>>;
        expect(rows).toHaveLength(2);
        expect(rows[0]).toMatchObject({
            conversationId: VALID_ID,
            role: 'user',
            status: 'complete',
        });
        expect(typeof rows[0]!.seq).toBe('object'); // drizzle SQL 객체(max(seq)+1)
        expect(rows[1]).toMatchObject({ modelId: 'deepseek-v4.1-flash' });
        expect(db.update).toHaveBeenCalledTimes(1);
    });

    it('supersedeAfterLastUser는 마지막 user 이후 행만 superseded', async () => {
        const db = chain([
            { seq: 1, role: 'user' },
            { seq: 2, role: 'assistant' },
            { seq: 3, role: 'user' },
            { seq: 4, role: 'assistant' },
        ]);
        const repo = new DrizzleChatConversationRepository(
            db as unknown as SiglensDatabase
        );
        expect(await repo.supersedeAfterLastUser(VALID_ID)).toBe(3);
        expect(db.set).toHaveBeenLastCalledWith({ status: 'superseded' });
    });

    it('supersedeAfterLastUser: user 행이 없으면 null, update 없음', async () => {
        const db = chain([
            { seq: 1, role: 'assistant' },
            { seq: 2, role: 'assistant' },
        ]);
        const repo = new DrizzleChatConversationRepository(
            db as unknown as SiglensDatabase
        );
        expect(await repo.supersedeAfterLastUser(VALID_ID)).toBeNull();
        expect(db.update).not.toHaveBeenCalled();
    });

    it('deleteFromSeq는 delete 후 messageCount를 count(*) 재계산 표현식으로 갱신한다', async () => {
        const db = chain([]);
        const repo = new DrizzleChatConversationRepository(
            db as unknown as SiglensDatabase
        );
        await repo.deleteFromSeq(VALID_ID, 3);
        expect(db.delete).toHaveBeenCalledTimes(1);
        expect(db.update).toHaveBeenCalledTimes(1);
        const setArg = (db.set as ReturnType<typeof vi.fn>).mock
            .lastCall![0] as Record<string, unknown>;
        expect(typeof setArg.messageCount).toBe('object'); // drizzle SQL 객체(count(*) 서브쿼리)
        expect(setArg.updatedAt).toBeInstanceOf(Date);
    });
});
