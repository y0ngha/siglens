import { DrizzleSessionRepository } from '@/entities/session';
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

    it('returns the number of expired sessions deleted', async () => {
        const {
            db,
            delete: deleteFn,
            where,
            returning,
        } = makeDeleteDb([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
        const repository = new DrizzleSessionRepository(db);
        const now = new Date('2026-04-30T00:00:00.000Z');

        const result = await repository.deleteExpiredSessions(now);

        expect(deleteFn).toHaveBeenCalledWith(expect.any(Object));
        expect(where).toHaveBeenCalledWith(expect.any(Object));
        expect(returning).toHaveBeenCalledWith({ id: expect.any(Object) });
        expect(result).toBe(3);
    });

    it('returns 0 when no sessions are expired', async () => {
        const { db } = makeDeleteDb([]);
        const repository = new DrizzleSessionRepository(db);
        const result = await repository.deleteExpiredSessions(new Date());
        expect(result).toBe(0);
    });

    it('uses the current time when no `now` argument is supplied', async () => {
        const { db } = makeDeleteDb([{ id: 'expired' }]);
        const repository = new DrizzleSessionRepository(db);
        const result = await repository.deleteExpiredSessions();
        expect(result).toBe(1);
    });
});
