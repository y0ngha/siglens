import type { Mock } from 'vitest';
import { feedback } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { DrizzleFeedbackRepository } from '../api';
import type { CreateFeedbackRecord } from '../lib/types';

/** Drizzle 조건식 그래프의 모든 문자열(컬럼 이름·바인딩 값)을 모은다. */
function collectStrings(
    node: unknown,
    depth = 0,
    seen = new Set<unknown>()
): string[] {
    if (depth > 8 || node === null) return [];
    if (typeof node === 'string') return [node];
    if (typeof node !== 'object') return [];
    if (seen.has(node)) return [];
    seen.add(node);
    return Object.values(node as Record<string, unknown>).flatMap(v =>
        collectStrings(v, depth + 1, seen)
    );
}

function makeDb(rows: unknown[] = [{ id: 'row-1' }]): {
    db: SiglensDatabase;
    insert: Mock;
    values: Mock;
    update: Mock;
    set: Mock;
    del: Mock;
    where: Mock;
    returning: Mock;
    select: Mock;
    orderBy: Mock;
    limit: Mock;
} {
    const returning = vi.fn().mockResolvedValue(rows);
    const limit = vi.fn().mockResolvedValue(rows);
    const orderBy = vi.fn(() => ({ limit }));
    const where = vi.fn(() => ({ returning, orderBy }));
    const values = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    const insert = vi.fn(() => ({ values }));
    const update = vi.fn(() => ({ set }));
    const del = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from: vi.fn(() => ({ where })) }));
    return {
        db: {
            insert,
            update,
            delete: del,
            select,
        } as unknown as SiglensDatabase,
        insert,
        values,
        update,
        set,
        del,
        where,
        returning,
        select,
        orderBy,
        limit,
    };
}

const record: CreateFeedbackRecord = {
    kind: 'ai_response',
    surface: 'siglens',
    rating: null,
    vote: 'down',
    reasons: null,
    comment: null,
    targetType: 'technical',
    symbol: 'AAPL',
    context: { analysisType: 'technical' },
    snapshot: { truncated: false, value: {} },
    userId: null,
    conversationId: null,
    pagePath: '/AAPL',
    locale: 'ko',
};

describe('DrizzleFeedbackRepository', () => {
    describe('create', () => {
        it('feedback 테이블에 명시 필드로 INSERT 하고 id 를 돌려준다', async () => {
            const { db, insert, values } = makeDb([{ id: 'abc' }]);

            const id = await new DrizzleFeedbackRepository(db).create(record);

            expect(id).toBe('abc');
            expect(insert).toHaveBeenCalledWith(feedback);
            expect(values).toHaveBeenCalledWith(record);
        });

        it('행이 돌아오지 않으면 던진다', async () => {
            const { db } = makeDb([]);
            await expect(
                new DrizzleFeedbackRepository(db).create(record)
            ).rejects.toThrow('feedback insert returned no row');
        });

        it('DB 오류를 호출자에게 전파한다', async () => {
            const { db, returning } = makeDb();
            returning.mockRejectedValue(new Error('db lost'));
            await expect(
                new DrizzleFeedbackRepository(db).create(record)
            ).rejects.toThrow('db lost');
        });
    });

    describe('updateAiFeedback', () => {
        it('방향 변경은 vote=down 조건 없이 kind=ai_response 와 id 로 갱신한다', async () => {
            const { db, set, where } = makeDb();

            const ok = await new DrizzleFeedbackRepository(db).updateAiFeedback(
                'id-1',
                { vote: 'up', reasons: null, comment: null },
                'user-1'
            );

            expect(ok).toBe(true);
            expect(set).toHaveBeenCalledWith({
                vote: 'up',
                reasons: null,
                comment: null,
            });
            const strings = collectStrings(where.mock.lastCall?.[0]);
            expect(strings).toContain('id-1');
            expect(strings).toContain('ai_response');
            expect(strings).toContain('user-1');
            expect(strings).not.toContain('down');
        });

        it('사유·의견만 덧붙이면 현재 vote=down 인 행에만 적용한다', async () => {
            const { db, set, where } = makeDb();

            await new DrizzleFeedbackRepository(db).updateAiFeedback(
                'id-1',
                { reasons: ['inaccurate'], comment: '틀림' },
                null
            );

            expect(set).toHaveBeenCalledWith({
                reasons: ['inaccurate'],
                comment: '틀림',
            });
            expect(collectStrings(where.mock.lastCall?.[0])).toContain('down');
        });

        it('비회원 요청은 user_id 가 빈 행에만 적용한다', async () => {
            const { db, where } = makeDb();

            await new DrizzleFeedbackRepository(db).updateAiFeedback(
                'id-1',
                { vote: 'down' },
                null
            );

            const text = collectStrings(where.mock.lastCall?.[0]).join(' ');
            expect(text).toMatch(/is null/i);
            expect(text).not.toContain('user-1');
        });

        it('갱신된 행이 없으면 false 이다', async () => {
            const { db } = makeDb([]);
            expect(
                await new DrizzleFeedbackRepository(db).updateAiFeedback(
                    'x',
                    { vote: 'up' },
                    null
                )
            ).toBe(false);
        });

        it('빈 패치는 DB 를 건드리지 않고 false 이다', async () => {
            const { db, update } = makeDb();
            expect(
                await new DrizzleFeedbackRepository(db).updateAiFeedback(
                    'x',
                    {},
                    null
                )
            ).toBe(false);
            expect(update).not.toHaveBeenCalled();
        });
    });

    describe('listAiFeedbackSince', () => {
        it('kind=ai_response 와 기준 시각으로 가벼운 컬럼만 조회한다', async () => {
            const rows = [{ surface: 'siglens' }];
            const { db, select, where, limit } = makeDb(rows);
            const since = new Date('2026-11-07T00:00:00Z');

            const result = await new DrizzleFeedbackRepository(
                db
            ).listAiFeedbackSince(since);

            expect(result).toBe(rows);
            const projection = select.mock.lastCall?.[0] as Record<
                string,
                unknown
            >;
            expect(Object.keys(projection).sort()).toEqual(
                [
                    'comment',
                    'createdAt',
                    'reasons',
                    'surface',
                    'symbol',
                    'targetType',
                    'vote',
                ].sort()
            );
            expect(collectStrings(where.mock.lastCall?.[0])).toContain(
                'ai_response'
            );
            expect(limit).toHaveBeenCalledWith(20_000);
        });
    });

    describe('deleteOlderThan', () => {
        it('삭제한 행 수를 돌려준다', async () => {
            const { db, del, where } = makeDb([{ id: 'a' }, { id: 'b' }]);

            const count = await new DrizzleFeedbackRepository(
                db
            ).deleteOlderThan(new Date('2025-11-08T00:00:00Z'));

            expect(count).toBe(2);
            expect(del).toHaveBeenCalledWith(feedback);
            expect(where).toHaveBeenCalledTimes(1);
        });
    });
});
