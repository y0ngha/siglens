import {
    AUTH_SESSION_COOKIE_NAME,
    DEFAULT_SESSION_TTL_SECONDS,
} from '@/infrastructure/auth/sessionCookie';
import { socialLoginUser } from '@/infrastructure/auth/use-cases/socialLoginUser';
import type {
    AuthSessionRecord,
    AuthUserRecord,
    OAuthUserRepository,
    SessionRepository,
} from '@/infrastructure/db/types';

const now = new Date('2026-04-27T00:00:00.000Z');
const createdAt = new Date('2026-04-26T00:00:00.000Z');
const updatedAt = new Date('2026-04-26T00:00:01.000Z');
const defaultExpiresAt = new Date('2026-05-27T00:00:00.000Z');
const defaultInput = {
    provider: 'google' as const,
    providerAccountId: ' google-account-1 ',
    email: ' User@Example.COM ',
    name: ' Ada ',
    avatarUrl: ' https://example.com/avatar.png ',
};

function makeUser(id: string): AuthUserRecord {
    return {
        id,
        email: 'user@example.com',
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
    oauthUsers?: Array<AuthUserRecord | null>;
    emailUser?: AuthUserRecord | null;
    createdUser?: AuthUserRecord | null;
    session?: AuthSessionRecord;
}): {
    dependencies: {
        users: OAuthUserRepository;
        sessions: SessionRepository;
    };
    findByOAuthAccount: ReturnType<typeof jest.fn>;
    findByEmail: ReturnType<typeof jest.fn>;
    createOAuthUser: ReturnType<typeof jest.fn>;
    createSession: ReturnType<typeof jest.fn>;
} {
    const oauthUsers = options?.oauthUsers ?? [null];
    const findByOAuthAccount = jest
        .fn()
        .mockImplementation(() => Promise.resolve(oauthUsers.shift() ?? null));
    const findByEmail = jest.fn().mockResolvedValue(options?.emailUser ?? null);
    const createdUser =
        options && 'createdUser' in options
            ? options.createdUser
            : makeUser('user-1');
    const createOAuthUser = jest.fn().mockResolvedValue(createdUser);
    const createSession = jest
        .fn()
        .mockResolvedValue(options?.session ?? makeSession(defaultExpiresAt));
    const deleteSession = jest.fn().mockResolvedValue(false);

    return {
        dependencies: {
            users: {
                findByOAuthAccount,
                findByEmail,
                createOAuthUser,
            },
            sessions: {
                createSession,
                findSession: jest.fn(),
                deleteSession,
                deleteExpiredSessions: jest.fn(),
            },
        },
        findByOAuthAccount,
        findByEmail,
        createOAuthUser,
        createSession,
    };
}

describe('socialLoginUser', () => {
    it('logs in an existing OAuth account without checking email conflicts', async () => {
        const existingUser = makeUser('user-1');
        const {
            dependencies,
            findByOAuthAccount,
            findByEmail,
            createOAuthUser,
            createSession,
        } = makeDependencies({ oauthUsers: [existingUser] });

        const result = await socialLoginUser(defaultInput, dependencies, {
            now,
        });

        expect(findByOAuthAccount).toHaveBeenCalledWith(
            'google',
            'google-account-1'
        );
        expect(findByEmail).not.toHaveBeenCalled();
        expect(createOAuthUser).not.toHaveBeenCalled();
        expect(createSession).toHaveBeenCalledWith({
            userId: 'user-1',
            expiresAt: defaultExpiresAt,
        });
        expect(result).toEqual({
            ok: true,
            user: existingUser,
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

    it('rejects a blank provider account id before repository access', async () => {
        const {
            dependencies,
            findByOAuthAccount,
            findByEmail,
            createOAuthUser,
            createSession,
        } = makeDependencies();

        const result = await socialLoginUser(
            { ...defaultInput, providerAccountId: '   ' },
            dependencies,
            { now }
        );

        expect(result).toEqual({
            ok: false,
            error: {
                code: 'invalid_oauth_profile',
                message:
                    'OAuth 프로필에서 유효한 이메일 또는 계정 정보를 찾을 수 없습니다.',
            },
        });
        expect(findByOAuthAccount).not.toHaveBeenCalled();
        expect(findByEmail).not.toHaveBeenCalled();
        expect(createOAuthUser).not.toHaveBeenCalled();
        expect(createSession).not.toHaveBeenCalled();
    });

    it('rejects an invalid provider email before repository access', async () => {
        const {
            dependencies,
            findByOAuthAccount,
            findByEmail,
            createOAuthUser,
            createSession,
        } = makeDependencies();

        const result = await socialLoginUser(
            { ...defaultInput, email: 'invalid-email' },
            dependencies,
            { now }
        );

        expect(result).toEqual({
            ok: false,
            error: {
                code: 'invalid_oauth_profile',
                message:
                    'OAuth 프로필에서 유효한 이메일 또는 계정 정보를 찾을 수 없습니다.',
            },
        });
        expect(findByOAuthAccount).not.toHaveBeenCalled();
        expect(findByEmail).not.toHaveBeenCalled();
        expect(createOAuthUser).not.toHaveBeenCalled();
        expect(createSession).not.toHaveBeenCalled();
    });

    it('returns an email conflict when the OAuth email is already registered', async () => {
        const { dependencies, createOAuthUser, createSession } =
            makeDependencies({ emailUser: makeUser('user-1') });

        const result = await socialLoginUser(defaultInput, dependencies, {
            now,
        });

        expect(createOAuthUser).not.toHaveBeenCalled();
        expect(createSession).not.toHaveBeenCalled();
        expect(result).toEqual({
            ok: false,
            error: {
                code: 'email_already_exists',
                message:
                    '이미 다른 로그인 방법으로 가입된 이메일입니다.',
            },
        });
    });

    it('creates a free-tier OAuth user, links the account, and creates a session', async () => {
        const createdUser = makeUser('user-1');
        const { dependencies, findByEmail, createOAuthUser } = makeDependencies(
            { createdUser }
        );

        const result = await socialLoginUser(defaultInput, dependencies, {
            now,
        });

        expect(findByEmail).toHaveBeenCalledWith('user@example.com');
        expect(createOAuthUser).toHaveBeenCalledWith({
            email: 'user@example.com',
            provider: 'google',
            providerAccountId: 'google-account-1',
            name: 'Ada',
            avatarUrl: 'https://example.com/avatar.png',
            accessToken: undefined,
            refreshToken: undefined,
            tokenExpiresAt: undefined,
        });
        expect(result).toEqual(
            expect.objectContaining({
                ok: true,
                user: createdUser,
            })
        );
    });

    it('omits optional profile fields when provider profile does not include them', async () => {
        const createdUser = makeUser('user-1');
        const { dependencies, createOAuthUser } = makeDependencies({
            createdUser,
        });

        const result = await socialLoginUser(
            {
                provider: 'google',
                providerAccountId: 'google-account-1',
                email: 'user@example.com',
            },
            dependencies,
            { now }
        );

        expect(createOAuthUser).toHaveBeenCalledWith({
            email: 'user@example.com',
            provider: 'google',
            providerAccountId: 'google-account-1',
            name: undefined,
            avatarUrl: undefined,
            accessToken: undefined,
            refreshToken: undefined,
            tokenExpiresAt: undefined,
        });
        expect(result).toEqual(
            expect.objectContaining({
                ok: true,
                user: createdUser,
            })
        );
    });

    it('uses the raced provider link when creation loses to another OAuth login', async () => {
        const racedUser = makeUser('user-1');
        const { dependencies, findByOAuthAccount, createSession } =
            makeDependencies({
                oauthUsers: [null, racedUser],
                createdUser: null,
            });

        const result = await socialLoginUser(defaultInput, dependencies, {
            now,
        });

        expect(findByOAuthAccount).toHaveBeenCalledTimes(2);
        expect(createSession).toHaveBeenCalledWith({
            userId: 'user-1',
            expiresAt: defaultExpiresAt,
        });
        expect(result).toEqual(
            expect.objectContaining({
                ok: true,
                user: racedUser,
            })
        );
    });

    it('returns an email conflict when creation fails without a raced provider link', async () => {
        const { dependencies, createSession } = makeDependencies({
            oauthUsers: [null, null],
            createdUser: null,
        });

        const result = await socialLoginUser(defaultInput, dependencies, {
            now,
        });

        expect(createSession).not.toHaveBeenCalled();
        expect(result).toEqual({
            ok: false,
            error: {
                code: 'email_already_exists',
                message:
                    '이미 다른 로그인 방법으로 가입된 이메일입니다.',
            },
        });
    });

    it('applies custom session and cookie options', async () => {
        const customExpiresAt = new Date('2026-04-27T01:00:00.000Z');
        const { dependencies } = makeDependencies({
            oauthUsers: [makeUser('user-1')],
            session: makeSession(customExpiresAt),
        });

        const result = await socialLoginUser(defaultInput, dependencies, {
            now,
            sessionTtlSeconds: 3600,
            cookieName: 'custom_session',
            secureCookie: false,
            sameSite: 'strict',
            path: '/app',
        });

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

    it('passes OAuth tokens to createOAuthUser when provided', async () => {
        const createdUser = makeUser('user-1');
        const { dependencies, createOAuthUser } = makeDependencies({
            createdUser,
        });
        const tokenExpiresAt = new Date('2026-05-30T00:00:00.000Z');

        await socialLoginUser(
            {
                provider: 'google',
                providerAccountId: 'google-account-1',
                email: 'user@example.com',
                accessToken: 'access-token-123',
                refreshToken: 'refresh-token-456',
                tokenExpiresAt,
            },
            dependencies,
            { now }
        );

        expect(createOAuthUser).toHaveBeenCalledWith(
            expect.objectContaining({
                accessToken: 'access-token-123',
                refreshToken: 'refresh-token-456',
                tokenExpiresAt,
            })
        );
    });
});
