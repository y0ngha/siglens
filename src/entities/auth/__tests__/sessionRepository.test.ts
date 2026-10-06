import {
    DrizzleSessionRepository,
    EXPIRED_SESSION_PRUNE_BATCH_SIZE,
} from '@/entities/auth/api';
import { createSqlCaptureDb } from '@/__tests__/utils/drizzleSqlCapture';
import { sessions } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';

const expiresAt = new Date('2026-05-27T00:00:00.000Z');
const sessionRecord = {
    id: 'session-1',
    userId: 'user-1',
    expiresAt,
    createdAt: new Date('2026-04-27T00:00:00.000Z'),
};

function makeInsertDb(rows: unknown[]): {
    db: SiglensDatabase;
    insert: ReturnType<typeof vi.fn>;
    values: ReturnType<typeof vi.fn>;
    returning: ReturnType<typeof vi.fn>;
} {
    const returning = vi.fn().mockResolvedValue(rows);
    const values = vi.fn(() => ({ returning }));
    const insert = vi.fn(() => ({ values }));

    return {
        db: { insert } as unknown as SiglensDatabase,
        insert,
        values,
        returning,
    };
}

function makeSelectDb(rows: unknown[]): {
    db: SiglensDatabase;
    select: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
} {
    const limit = vi.fn().mockResolvedValue(rows);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));

    return {
        db: { select } as unknown as SiglensDatabase,
        select,
        from,
        where,
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

describe('DrizzleSessionRepository', () => {
    it('creates a session for a user', async () => {
        const { db, insert, values, returning } = makeInsertDb([sessionRecord]);
        const repository = new DrizzleSessionRepository(db);

        const result = await repository.createSession({
            userId: 'user-1',
            expiresAt,
        });

        expect(insert).toHaveBeenCalledWith(expect.any(Object));
        expect(values).toHaveBeenCalledWith({
            userId: 'user-1',
            expiresAt,
        });
        expect(returning).toHaveBeenCalledWith({
            id: sessions.id,
            userId: sessions.userId,
            expiresAt: sessions.expiresAt,
            createdAt: sessions.createdAt,
        });
        expect(result).toEqual(sessionRecord);
    });

    it('returns the session record when one matches the token', async () => {
        const { db, select, from, where, limit } = makeSelectDb([
            sessionRecord,
        ]);
        const repository = new DrizzleSessionRepository(db);

        const result = await repository.findSession('session-1');

        expect(select).toHaveBeenCalledWith({
            id: sessions.id,
            userId: sessions.userId,
            expiresAt: sessions.expiresAt,
            createdAt: sessions.createdAt,
        });
        expect(from).toHaveBeenCalledWith(expect.any(Object));
        expect(where).toHaveBeenCalledWith(expect.any(Object));
        expect(limit).toHaveBeenCalledWith(1);
        expect(result).toEqual(sessionRecord);
    });

    it('returns null when no session matches the token', async () => {
        const { db } = makeSelectDb([]);
        const repository = new DrizzleSessionRepository(db);

        const result = await repository.findSession('missing-session');

        expect(result).toBeNull();
    });

    it('returns true when deleting an existing session', async () => {
        const {
            db,
            delete: deleteFn,
            where,
            returning,
        } = makeDeleteDb([{ id: 'session-1' }]);
        const repository = new DrizzleSessionRepository(db);

        const result = await repository.deleteSession('session-1');

        expect(deleteFn).toHaveBeenCalledWith(expect.any(Object));
        expect(where).toHaveBeenCalledWith(expect.any(Object));
        expect(returning).toHaveBeenCalledWith({ id: expect.any(Object) });
        expect(result).toBe(true);
    });

    it('returns false when no session is deleted', async () => {
        const { db } = makeDeleteDb([]);
        const repository = new DrizzleSessionRepository(db);

        const result = await repository.deleteSession('missing-session');

        expect(result).toBe(false);
    });

    describe('pruneExpiredSessions', () => {
        const NOW = new Date('2026-10-06T00:00:00.000Z');

        it('expires_at < now 인 행만, 배치 상한을 건 id 서브쿼리로 지운다', async () => {
            const { db, captured } = createSqlCaptureDb([
                { id: 's1' },
                { id: 's2' },
            ]);
            const repository = new DrizzleSessionRepository(db);

            const deleted = await repository.pruneExpiredSessions(NOW);

            expect(deleted).toBe(2);
            expect(captured).toHaveLength(1);
            const { sql: text, params } = captured[0]!;
            const lower = text.toLowerCase();
            expect(lower).toMatch(/^delete from "sessions"/);
            // 바깥 DELETE는 id IN (서브쿼리), 서브쿼리가 인덱스 컬럼(expires_at)으로 만료를 거른다.
            expect(lower).toContain('"id" in (select "id" from "sessions"');
            expect(lower).toContain('"sessions"."expires_at" < $1');
            expect(lower).toContain('limit $2');
            expect(params[0]).toBe(NOW.toISOString());
            expect(params[1]).toBe(EXPIRED_SESSION_PRUNE_BATCH_SIZE);
        });

        it('지울 행이 없으면 0을 반환한다', async () => {
            const { db } = createSqlCaptureDb([]);
            const repository = new DrizzleSessionRepository(db);

            await expect(repository.pruneExpiredSessions(NOW)).resolves.toBe(0);
        });
    });
});
