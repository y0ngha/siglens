import { getRounds } from 'bcryptjs';
import {
    LOGIN_RATE_LIMITS,
    LOGIN_TIMING_DUMMY_HASH,
} from '@/entities/auth/lib/authUseCaseConstants';
import type { LoginUserDependencies } from '@/entities/auth/lib/authUseCaseTypes';
import { loginUser } from '@/entities/auth/lib/loginUser';
import { DEFAULT_SESSION_TTL_SECONDS } from '@/entities/auth/lib/sessionCookie';
import { hashEmailToken } from '@/entities/auth/lib/tokenUtils';
import { AUTH_SESSION_COOKIE_NAME } from '@/shared/config/cookieNames';
import type { AuthSessionRecord, EmailAuthUserRecord } from '@/shared/db/types';
import { createFakeFixedWindowLimiter } from '@/shared/test-utils/fakeFixedWindowLimiter';

const IP_HASH = 'iphash';
const EMAIL_HASH = hashEmailToken('user@example.com');
const KEYS = {
    ip: `auth:login:ip:${IP_HASH}`,
    ipDay: `auth:login:ip:d:${IP_HASH}`,
    pair: `auth:login:ei:${hashEmailToken(`${EMAIL_HASH}:${IP_HASH}`)}`,
    email: `auth:login:e:${EMAIL_HASH}`,
} as const;

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
    /** 이 키의 한도 확인만 거부한다. 나머지는 실제 카운팅 가짜 한도를 쓴다. */
    blockKey?: string;
}): {
    dependencies: LoginUserDependencies;
    limiter: ReturnType<typeof createFakeFixedWindowLimiter>;
    findEmailAuthUserByEmail: ReturnType<typeof vi.fn>;
    verifyPassword: ReturnType<typeof vi.fn>;
    createSession: ReturnType<typeof vi.fn>;
    deleteSession: ReturnType<typeof vi.fn>;
} {
    const user = options && 'user' in options ? options.user : makeUser('hash');
    const passwordMatches =
        options && 'passwordMatches' in options
            ? options.passwordMatches
            : true;
    const session = options?.session ?? makeSession(defaultExpiresAt);
    const limiter = createFakeFixedWindowLimiter();
    const blockKey = options?.blockKey;
    const findEmailAuthUserByEmail = vi.fn().mockResolvedValue(user);
    const verifyPassword = vi.fn().mockResolvedValue(passwordMatches);
    const createSession = vi.fn().mockResolvedValue(session);
    const deleteSession = vi.fn().mockResolvedValue(false);

    return {
        dependencies: {
            users: { findEmailAuthUserByEmail },
            sessions: {
                createSession,
                findSession: vi.fn(),
                deleteSession,
            },
            passwordVerifier: { verifyPassword },
            rateLimit: async rule => {
                const allowed = await limiter.rateLimit(rule);
                return allowed && rule.key !== blockKey;
            },
            resetCounter: limiter.resetCounter,
            ipHash: async () => IP_HASH,
        },
        limiter,
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
            vi.useFakeTimers();
            vi.setSystemTime(fixedNow);
        });

        afterEach(() => {
            vi.useRealTimers();
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
        expect(verifyPassword).toHaveBeenCalledTimes(1);
        expect(verifyPassword).toHaveBeenCalledWith(
            'Password1',
            LOGIN_TIMING_DUMMY_HASH
        );
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
        expect(verifyPassword).toHaveBeenCalledTimes(1);
        expect(verifyPassword).toHaveBeenCalledWith(
            'Password1',
            LOGIN_TIMING_DUMMY_HASH
        );
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

    describe('균일한 시간', () => {
        it('the dummy hash is a real cost-12 bcrypt hash, not a malformed string', () => {
            expect(LOGIN_TIMING_DUMMY_HASH).toMatch(
                /^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/
            );
            expect(getRounds(LOGIN_TIMING_DUMMY_HASH)).toBe(12);
        });

        it('runs exactly one bcrypt comparison for a missing account, a passwordless account and a wrong password', async () => {
            const missing = makeDependencies({ user: null });
            const passwordless = makeDependencies({ user: makeUser(null) });
            const wrong = makeDependencies({ passwordMatches: false });
            const input = { email: 'user@example.com', password: 'Password1' };

            await loginUser(input, missing.dependencies, { now });
            await loginUser(input, passwordless.dependencies, { now });
            await loginUser(input, wrong.dependencies, { now });

            expect(missing.verifyPassword).toHaveBeenCalledTimes(1);
            expect(passwordless.verifyPassword).toHaveBeenCalledTimes(1);
            expect(wrong.verifyPassword).toHaveBeenCalledTimes(1);
        });

        it('never compares against the dummy for an account with a password', async () => {
            const { dependencies, verifyPassword } = makeDependencies();

            await loginUser(
                { email: 'user@example.com', password: 'Password1' },
                dependencies,
                { now }
            );

            expect(verifyPassword).toHaveBeenCalledWith('Password1', 'hash');
            expect(verifyPassword).not.toHaveBeenCalledWith(
                expect.anything(),
                LOGIN_TIMING_DUMMY_HASH
            );
        });
    });

    describe('남용 한도', () => {
        it('declares the agreed limits', () => {
            expect(LOGIN_RATE_LIMITS).toEqual({
                perIp: { limit: 30, windowSeconds: 900 },
                perIpDay: { limit: 200, windowSeconds: 86400 },
                perEmailIp: { limit: 10, windowSeconds: 900 },
                perEmail: { limit: 20, windowSeconds: 3600 },
            });
        });

        it('counts IP, IP day, pair and address, in that order, before the lookup', async () => {
            const { dependencies, limiter, findEmailAuthUserByEmail } =
                makeDependencies();
            const rateLimit = vi.spyOn(dependencies, 'rateLimit');

            await loginUser(
                { email: 'user@example.com', password: 'Password1' },
                dependencies,
                { now }
            );

            expect(limiter.calls.map(rule => rule.key)).toEqual([
                KEYS.ip,
                KEYS.ipDay,
                KEYS.pair,
                KEYS.email,
            ]);
            expect(
                Math.max(...rateLimit.mock.invocationCallOrder)
            ).toBeLessThan(
                Math.min(...findEmailAuthUserByEmail.mock.invocationCallOrder)
            );
        });

        it.each([
            ['ip', KEYS.ip],
            ['ipDay', KEYS.ipDay],
        ] as const)(
            'returns rate_limited without lookup, bcrypt or session when the %s rule blocks',
            async (_name, key) => {
                const {
                    dependencies,
                    limiter,
                    findEmailAuthUserByEmail,
                    verifyPassword,
                    createSession,
                } = makeDependencies({ blockKey: key });

                const result = await loginUser(
                    { email: 'user@example.com', password: 'Password1' },
                    dependencies,
                    { now }
                );

                expect(result).toMatchObject({
                    ok: false,
                    error: { code: 'rate_limited' },
                });
                expect(findEmailAuthUserByEmail).not.toHaveBeenCalled();
                expect(verifyPassword).not.toHaveBeenCalled();
                expect(createSession).not.toHaveBeenCalled();
                expect(limiter.count(KEYS.pair)).toBe(0);
                expect(limiter.count(KEYS.email)).toBe(0);
            }
        );

        it.each([
            ['pair', KEYS.pair],
            ['email', KEYS.email],
        ] as const)(
            'returns too_many_login_attempts without lookup, bcrypt or session when the %s rule blocks',
            async (_name, key) => {
                const {
                    dependencies,
                    findEmailAuthUserByEmail,
                    verifyPassword,
                    createSession,
                } = makeDependencies({ blockKey: key });

                const result = await loginUser(
                    { email: 'user@example.com', password: 'Password1' },
                    dependencies,
                    { now }
                );

                expect(result).toMatchObject({
                    ok: false,
                    error: { code: 'too_many_login_attempts' },
                });
                expect(findEmailAuthUserByEmail).not.toHaveBeenCalled();
                expect(verifyPassword).not.toHaveBeenCalled();
                expect(createSession).not.toHaveBeenCalled();
            }
        );

        it('refuses the 11th attempt on one pair even with the right password', async () => {
            const wrong = makeDependencies({ passwordMatches: false });
            const attempt = (dependencies: LoginUserDependencies) =>
                loginUser(
                    { email: 'user@example.com', password: 'Password1' },
                    dependencies,
                    { now }
                );
            const tenFails = await Promise.all(
                Array.from({ length: 10 }, () => attempt(wrong.dependencies))
            );
            // 같은 한도 카운터를 쓰되 비밀번호 검증은 통과하게 바꾼다.
            const rightPassword = await attempt({
                ...wrong.dependencies,
                passwordVerifier: {
                    verifyPassword: vi.fn().mockResolvedValue(true),
                },
            });

            expect(
                tenFails.every(
                    result =>
                        !result.ok &&
                        result.error.code === 'invalid_credentials'
                )
            ).toBe(true);
            expect(rightPassword).toMatchObject({
                ok: false,
                error: { code: 'too_many_login_attempts' },
            });
            expect(wrong.createSession).not.toHaveBeenCalled();
        });

        it('on success clears only the pair key, never the address key', async () => {
            const { dependencies, limiter } = makeDependencies();

            const result = await loginUser(
                { email: 'user@example.com', password: 'Password1' },
                dependencies,
                { now }
            );

            expect(result).toMatchObject({ ok: true });
            expect(limiter.count(KEYS.pair)).toBe(0);
            expect(limiter.count(KEYS.email)).toBe(1);
            expect(limiter.count(KEYS.ip)).toBe(1);
            expect(limiter.count(KEYS.ipDay)).toBe(1);
        });

        it('keeps the counters after a failed login', async () => {
            const { dependencies, limiter } = makeDependencies({
                passwordMatches: false,
            });

            await loginUser(
                { email: 'user@example.com', password: 'wrong' },
                dependencies,
                { now }
            );

            expect(limiter.count(KEYS.pair)).toBe(1);
            expect(limiter.count(KEYS.email)).toBe(1);
        });

        it('still logs in when releasing the pair key fails', async () => {
            const { dependencies } = makeDependencies();
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

            const result = await loginUser(
                { email: 'user@example.com', password: 'Password1' },
                {
                    ...dependencies,
                    resetCounter: vi.fn().mockRejectedValue(new Error('down')),
                },
                { now }
            );

            expect(result).toMatchObject({ ok: true });
            expect(warn).toHaveBeenCalled();
            warn.mockRestore();
        });

        it('counts an unknown address under the same keys as a known one', async () => {
            const known = makeDependencies();
            const unknown = makeDependencies({ user: null });
            const input = { email: 'user@example.com', password: 'Password1' };

            await loginUser(input, known.dependencies, { now });
            await loginUser(input, unknown.dependencies, { now });

            expect(unknown.limiter.calls).toEqual(known.limiter.calls);
        });

        it('keeps the raw email out of every limiter key', async () => {
            const { dependencies, limiter } = makeDependencies();

            await loginUser(
                { email: 'user@example.com', password: 'Password1' },
                dependencies,
                { now }
            );

            expect(limiter.calls.length).toBeGreaterThan(0);
            expect(
                limiter.calls.filter(rule => rule.key.includes('example.com'))
            ).toEqual([]);
        });
    });
});
