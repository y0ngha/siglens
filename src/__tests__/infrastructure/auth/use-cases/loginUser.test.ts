import {
    AUTH_SESSION_COOKIE_NAME,
    DEFAULT_SESSION_TTL_SECONDS,
} from '@/infrastructure/auth/sessionCookie';
import { loginUser } from '@/infrastructure/auth/use-cases/loginUser';
import type { PasswordVerifier } from '@/infrastructure/auth/types';
import type {
    AuthSessionRecord,
    EmailAuthUserRecord,
    EmailAuthUserRepository,
    SessionRepository,
} from '@/shared/db/types';

const now = new Date('2026-04-27T00:00:00.000Z');
const createdAt = new Date('2026-04-26T00:00:00.000Z');
const updatedAt = new Date('2026-04-26T00:00:01.000Z');
const defaultExpiresAt = new Date('2026-05-27T00:00:00.000Z');

function makeUser(passwordHash: string | null): EmailAuthUserRecord {
    return {
        id: 'user-1',
        email: 'user@example.com',
        passwordHash,
        name: null,
        avatarUrl: null,
        tier: 'free',

        emailVerified: true,
        createdAt,
        updatedAt,
    };
}

function makeSession(expiresAt: Date): AuthSessionRecord {
    return {
        id: 'session-1',
        userId: 'user-1',
        expiresAt,
        createdAt: now,
    };
}

function makeDependencies(options?: {
    user?: EmailAuthUserRecord | null;
    passwordMatches?: boolean;
    session?: AuthSessionRecord;
}): {
    dependencies: {
        users: EmailAuthUserRepository;
        sessions: SessionRepository;
        passwordVerifier: PasswordVerifier;
    };
    findEmailAuthUserByEmail: ReturnType<typeof jest.fn>;
    verifyPassword: ReturnType<typeof jest.fn>;
    createSession: ReturnType<typeof jest.fn>;
    deleteSession: ReturnType<typeof jest.fn>;
} {
    const user = options && 'user' in options ? options.user : makeUser('hash');
    const passwordMatches =
        options && 'passwordMatches' in options
            ? options.passwordMatches
            : true;
    const session = options?.session ?? makeSession(defaultExpiresAt);
    const findEmailAuthUserByEmail = jest.fn().mockResolvedValue(user);
    const verifyPassword = jest.fn().mockResolvedValue(passwordMatches);
    const createSession = jest.fn().mockResolvedValue(session);
    const deleteSession = jest.fn().mockResolvedValue(false);

    return {
        dependencies: {
            users: { findEmailAuthUserByEmail },
            sessions: {
                createSession,
                findSession: jest.fn(),
                deleteSession,
                deleteExpiredSessions: jest.fn(),
            },
            passwordVerifier: { verifyPassword },
        },
        findEmailAuthUserByEmail,
        verifyPassword,
        createSession,
        deleteSession,
    };
}

describe('loginUser', () => {
    describe('when options.now is not provided', () => {
        const fixedNow = new Date('2026-04-27T12:00:00.000Z');

        beforeEach(() => {
            jest.useFakeTimers();
            jest.setSystemTime(fixedNow);
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('uses the current system time as the session start', async () => {
            const expectedExpiresAt = new Date(
                fixedNow.getTime() + DEFAULT_SESSION_TTL_SECONDS * 1000
            );
            const { dependencies, createSession } = makeDependencies({
                session: makeSession(expectedExpiresAt),
            });

            const result = await loginUser(
                { email: 'user@example.com', password: 'Password1' },
                dependencies
            );

            expect(createSession).toHaveBeenCalledWith({
                userId: 'user-1',
                expiresAt: expectedExpiresAt,
            });
            expect(result).toMatchObject({ ok: true });
        });
    });

    it('returns invalid credentials when no user is found', async () => {
        const { dependencies, verifyPassword, createSession } =
            makeDependencies({ user: null });

        const result = await loginUser(
            { email: 'missing@example.com', password: 'Password1' },
            dependencies,
            { now }
        );

        expect(result).toEqual({
            ok: false,
            error: {
                code: 'invalid_credentials',
                message: '이메일 또는 비밀번호가 올바르지 않습니다.',
            },
        });
        expect(verifyPassword).not.toHaveBeenCalled();
        expect(createSession).not.toHaveBeenCalled();
    });

    it('returns invalid credentials when the account has no password hash', async () => {
        const { dependencies, verifyPassword, createSession } =
            makeDependencies({ user: makeUser(null) });

        const result = await loginUser(
            { email: 'user@example.com', password: 'Password1' },
            dependencies,
            { now }
        );

        expect(result).toEqual({
            ok: false,
            error: {
                code: 'invalid_credentials',
                message: '이메일 또는 비밀번호가 올바르지 않습니다.',
            },
        });
        expect(verifyPassword).not.toHaveBeenCalled();
        expect(createSession).not.toHaveBeenCalled();
    });

    it('returns invalid credentials when password verification fails', async () => {
        const { dependencies, verifyPassword, createSession } =
            makeDependencies({ passwordMatches: false });

        const result = await loginUser(
            { email: 'user@example.com', password: 'wrong-password' },
            dependencies,
            { now }
        );

        expect(result).toEqual({
            ok: false,
            error: {
                code: 'invalid_credentials',
                message: '이메일 또는 비밀번호가 올바르지 않습니다.',
            },
        });
        expect(verifyPassword).toHaveBeenCalledWith('wrong-password', 'hash');
        expect(createSession).not.toHaveBeenCalled();
    });

    it('normalizes email, creates a session, and returns an HTTP-only cookie', async () => {
        const { dependencies, findEmailAuthUserByEmail, createSession } =
            makeDependencies();

        const result = await loginUser(
            { email: ' User@Example.COM ', password: 'Password1' },
            dependencies,
            { now }
        );

        expect(findEmailAuthUserByEmail).toHaveBeenCalledWith(
            'user@example.com'
        );
        expect(createSession).toHaveBeenCalledWith({
            userId: 'user-1',
            expiresAt: defaultExpiresAt,
        });
        expect(result).toEqual({
            ok: true,
            user: {
                id: 'user-1',
                email: 'user@example.com',
                name: null,
                avatarUrl: null,
                tier: 'free',

                emailVerified: true,
                createdAt,
                updatedAt,
            },
            session: makeSession(defaultExpiresAt),
            cookie: {
                name: AUTH_SESSION_COOKIE_NAME,
                value: 'session-1',
                httpOnly: true,
                secure: true,
                sameSite: 'lax',
                path: '/',
                expires: defaultExpiresAt,
                maxAgeSeconds: DEFAULT_SESSION_TTL_SECONDS,
            },
        });
    });

    it('applies custom session and cookie options', async () => {
        const customExpiresAt = new Date('2026-04-27T01:00:00.000Z');
        const { dependencies } = makeDependencies({
            session: makeSession(customExpiresAt),
        });

        const result = await loginUser(
            { email: 'user@example.com', password: 'Password1' },
            dependencies,
            {
                now,
                sessionTtlSeconds: 3600,
                cookieName: 'custom_session',
                secureCookie: false,
                sameSite: 'strict',
                path: '/app',
            }
        );

        expect(result).toEqual(
            expect.objectContaining({
                ok: true,
                cookie: {
                    name: 'custom_session',
                    value: 'session-1',
                    httpOnly: true,
                    secure: false,
                    sameSite: 'strict',
                    path: '/app',
                    expires: customExpiresAt,
                    maxAgeSeconds: 3600,
                },
            })
        );
    });
});
