import { vi } from 'vitest';
import { findUserBySessionToken } from '@/entities/user/lib/findUserBySessionToken';
import type {
    AuthSessionRecord,
    AuthUserRecord,
    SessionRepository,
    UserRepository,
} from '@/shared/db/types';

const sessionToken = 'session-token-1';
const now = new Date('2026-04-28T00:00:00.000Z');
const futureExpiresAt = new Date('2026-05-28T00:00:00.000Z');
const pastExpiresAt = new Date('2026-04-01T00:00:00.000Z');

const user: AuthUserRecord = {
    id: 'user-1',
    email: 'user@example.com',
    name: null,
    avatarUrl: null,
    tier: 'free',

    emailVerified: true,
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    updatedAt: new Date('2026-04-01T00:00:00.000Z'),
};

function makeSession(expiresAt: Date): AuthSessionRecord {
    return {
        id: sessionToken,
        userId: user.id,
        expiresAt,
        createdAt: new Date('2026-04-27T00:00:00.000Z'),
    };
}

function makeDependencies(options: {
    session: AuthSessionRecord | null;
    user?: AuthUserRecord | null;
}): {
    dependencies: {
        users: UserRepository;
        sessions: SessionRepository;
    };
    findSession: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
} {
    const findSession = vi.fn().mockResolvedValue(options.session);
    const findById = vi
        .fn()
        .mockResolvedValue(options.user === undefined ? user : options.user);

    return {
        dependencies: {
            users: {
                findByEmail: vi.fn(),
                findById,
                createEmailUser: vi.fn(),
                deleteUser: vi.fn(),
                updatePassword: vi.fn(),
            },
            sessions: {
                createSession: vi.fn(),
                findSession,
                deleteSession: vi.fn(),
                deleteExpiredSessions: vi.fn(),
            },
        },
        findSession,
        findById,
    };
}

describe('findUserBySessionToken', () => {
    it('returns the user when the session is active', async () => {
        const { dependencies, findSession, findById } = makeDependencies({
            session: makeSession(futureExpiresAt),
        });

        const result = await findUserBySessionToken(
            sessionToken,
            dependencies,
            { now }
        );

        expect(findSession).toHaveBeenCalledWith(sessionToken);
        expect(findById).toHaveBeenCalledWith(user.id);
        expect(result).toEqual(user);
    });

    it('returns null when no session row matches the token', async () => {
        const { dependencies, findById } = makeDependencies({ session: null });

        const result = await findUserBySessionToken(
            sessionToken,
            dependencies,
            { now }
        );

        expect(result).toBeNull();
        expect(findById).not.toHaveBeenCalled();
    });

    it('returns null when the session has expired', async () => {
        const { dependencies, findById } = makeDependencies({
            session: makeSession(pastExpiresAt),
        });

        const result = await findUserBySessionToken(
            sessionToken,
            dependencies,
            { now }
        );

        expect(result).toBeNull();
        expect(findById).not.toHaveBeenCalled();
    });

    it('treats expiresAt equal to now as expired', async () => {
        const { dependencies, findById } = makeDependencies({
            session: makeSession(now),
        });

        const result = await findUserBySessionToken(
            sessionToken,
            dependencies,
            { now }
        );

        expect(result).toBeNull();
        expect(findById).not.toHaveBeenCalled();
    });

    it('returns null when the session refers to a deleted user', async () => {
        const { dependencies } = makeDependencies({
            session: makeSession(futureExpiresAt),
            user: null,
        });

        const result = await findUserBySessionToken(
            sessionToken,
            dependencies,
            { now }
        );

        expect(result).toBeNull();
    });

    describe('when options.now is not provided', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(now);
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('uses the current system time to evaluate expiration', async () => {
            const { dependencies } = makeDependencies({
                session: makeSession(pastExpiresAt),
            });

            const result = await findUserBySessionToken(
                sessionToken,
                dependencies
            );

            expect(result).toBeNull();
        });
    });
});
