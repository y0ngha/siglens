import { confirmPasswordReset } from '@/entities/auth/lib/confirmPasswordReset';
import type { ConfirmPasswordResetDependencies } from '@/entities/auth/lib/authUseCaseTypes';
import { hashEmailToken } from '@/entities/auth/lib/tokenUtils';
import type {
    EmailTokenPurpose,
    EmailTokenValue,
} from '@/entities/email-token/types';
import type { EmailAuthUserRecord } from '@/shared/db/types';
import { createFakeFixedWindowLimiter } from '@/shared/test-utils/fakeFixedWindowLimiter';
import { PASSWORD_RESET_RATE_LIMITS } from '@/entities/auth/lib/authUseCaseConstants';

const IP_HASH = 'iphash';
const EMAIL_HASH = hashEmailToken('user@example.com');
const CONFIRM_IP_KEY = `auth:reset-confirm:ip:${IP_HASH}`;
const LOGIN_EMAIL_KEY = `auth:login:e:${EMAIL_HASH}`;
const LOGIN_PAIR_KEY = `auth:login:ei:${hashEmailToken(`${EMAIL_HASH}:${IP_HASH}`)}`;
const LOGIN_RULE = { limit: 100, windowSeconds: 900 } as const;

const RAW_TOKEN = 'raw-token-value';
const STORED_TOKEN_HASH = hashEmailToken(RAW_TOKEN);
const NEW_PASSWORD = 'NewSecret1';

const user: EmailAuthUserRecord = {
    id: 'user-1',
    email: 'user@example.com',
    passwordHash: 'old-hash',
    name: null,
    avatarUrl: null,
    tier: 'free',
    emailVerified: true,
    createdAt: new Date('2026-04-27T00:00:00.000Z'),
    updatedAt: new Date('2026-04-27T00:00:01.000Z'),
};

const VALID_TOKEN_VALUE: EmailTokenValue = {
    status: 'pending',
    tokenHash: STORED_TOKEN_HASH,
};

function makeDependencies(options?: {
    /** Controls emailTokens.get return value. Defaults to VALID_TOKEN_VALUE. */
    peekedToken?: EmailTokenValue | null;
    /** Controls emailTokens.consume return value. Defaults to peekedToken. */
    consumedToken?: EmailTokenValue | null;
    user?: EmailAuthUserRecord | null;
    updatePasswordResult?: boolean;
    hashedNewPassword?: string;
    isSamePassword?: boolean;
    /** 이 키의 한도 확인만 거부한다. 나머지는 실제 카운팅 가짜 한도를 쓴다. */
    blockKey?: string;
}): {
    dependencies: ConfirmPasswordResetDependencies;
    limiter: ReturnType<typeof createFakeFixedWindowLimiter>;
    getToken: ReturnType<typeof vi.fn>;
    consumeToken: ReturnType<typeof vi.fn>;
    findEmailAuthUserByEmail: ReturnType<typeof vi.fn>;
    updatePassword: ReturnType<typeof vi.fn>;
    hashPassword: ReturnType<typeof vi.fn>;
    verifyPassword: ReturnType<typeof vi.fn>;
} {
    const peeked =
        options && 'peekedToken' in options
            ? (options.peekedToken ?? null)
            : VALID_TOKEN_VALUE;
    const consumed =
        options && 'consumedToken' in options
            ? (options.consumedToken ?? null)
            : peeked;
    const limiter = createFakeFixedWindowLimiter();
    const blockKey = options?.blockKey;
    const foundUser = options && 'user' in options ? options.user : user;
    const updateResult = options?.updatePasswordResult ?? true;
    const hashed = options?.hashedNewPassword ?? 'new-hashed-password';
    const samePassword = options?.isSamePassword ?? false;

    const getToken = vi
        .fn<
            (
                purpose: EmailTokenPurpose,
                email: string
            ) => Promise<EmailTokenValue | null>
        >()
        .mockResolvedValue(peeked);
    const consumeToken = vi
        .fn<
            (
                purpose: EmailTokenPurpose,
                email: string
            ) => Promise<EmailTokenValue | null>
        >()
        .mockResolvedValue(consumed);
    const findEmailAuthUserByEmail = vi.fn().mockResolvedValue(foundUser);
    const updatePassword = vi.fn().mockResolvedValue(updateResult);
    const hashPassword = vi.fn().mockResolvedValue(hashed);
    const verifyPassword = vi.fn().mockResolvedValue(samePassword);

    return {
        dependencies: {
            emailAuthUsers: { findEmailAuthUserByEmail },
            users: {
                findByEmail: vi.fn(),
                findById: vi.fn(),
                createEmailUser: vi.fn(),
                deleteUser: vi.fn(),
                updatePassword,
            },
            emailTokens: {
                set: vi.fn(),
                get: getToken,
                delete: vi.fn(),
                consume: consumeToken,
            },
            passwordHasher: { hashPassword },
            passwordVerifier: { verifyPassword },
            rateLimit: async rule => {
                const allowed = await limiter.rateLimit(rule);
                return allowed && rule.key !== blockKey;
            },
            resetCounter: limiter.resetCounter,
            ipHash: async () => IP_HASH,
        },
        limiter,
        getToken,
        consumeToken,
        findEmailAuthUserByEmail,
        updatePassword,
        hashPassword,
        verifyPassword,
    };
}

describe('confirmPasswordReset', () => {
    it('returns weak_password error when password fails validation', async () => {
        const { dependencies, getToken, consumeToken, updatePassword } =
            makeDependencies();

        const result = await confirmPasswordReset(
            { email: 'user@example.com', token: RAW_TOKEN, newPassword: 'abc' },
            dependencies
        );

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('weak_password');
        expect(getToken).not.toHaveBeenCalled();
        expect(consumeToken).not.toHaveBeenCalled();
        expect(updatePassword).not.toHaveBeenCalled();
    });

    it('returns expired_token error when the token does not exist', async () => {
        const { dependencies, consumeToken, updatePassword } = makeDependencies(
            {
                peekedToken: null,
            }
        );

        const result = await confirmPasswordReset(
            {
                email: 'user@example.com',
                token: RAW_TOKEN,
                newPassword: NEW_PASSWORD,
            },
            dependencies
        );

        expect(result).toEqual({
            ok: false,
            error: {
                code: 'expired_token',
                field: 'token',
                message: '비밀번호 재설정 토큰이 만료되었습니다.',
            },
        });
        // Token does not exist — consume must not be called.
        expect(consumeToken).not.toHaveBeenCalled();
        expect(updatePassword).not.toHaveBeenCalled();
    });

    it('returns expired_token error when consume returns null (TOCTOU race)', async () => {
        // get succeeds (token existed at pre-validation time) but consume returns null
        // because a concurrent caller won the race and consumed the token first.
        const { dependencies, updatePassword } = makeDependencies({
            consumedToken: null,
        });

        const result = await confirmPasswordReset(
            {
                email: 'user@example.com',
                token: RAW_TOKEN,
                newPassword: NEW_PASSWORD,
            },
            dependencies
        );

        expect(result).toEqual({
            ok: false,
            error: {
                code: 'expired_token',
                field: 'token',
                message: '비밀번호 재설정 토큰이 만료되었습니다.',
            },
        });
        expect(updatePassword).not.toHaveBeenCalled();
    });

    it('returns invalid_token error when token entry is in verified state', async () => {
        const { dependencies, consumeToken } = makeDependencies({
            peekedToken: {
                status: 'verified',
                tokenHash: STORED_TOKEN_HASH,
                bindingHash: STORED_TOKEN_HASH,
            },
        });

        const result = await confirmPasswordReset(
            {
                email: 'user@example.com',
                token: RAW_TOKEN,
                newPassword: NEW_PASSWORD,
            },
            dependencies
        );

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('invalid_token');
        // Caught at pre-validation — token must not be consumed.
        expect(consumeToken).not.toHaveBeenCalled();
    });

    it('returns invalid_token error when the supplied token does not match', async () => {
        const { dependencies, consumeToken, updatePassword } =
            makeDependencies();

        const result = await confirmPasswordReset(
            {
                email: 'user@example.com',
                token: 'wrong-token',
                newPassword: NEW_PASSWORD,
            },
            dependencies
        );

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('invalid_token');
        // Caught at pre-validation — token must not be consumed.
        expect(consumeToken).not.toHaveBeenCalled();
        expect(updatePassword).not.toHaveBeenCalled();
    });

    it('returns invalid_token error when the user no longer exists', async () => {
        const { dependencies } = makeDependencies({ user: null });

        const result = await confirmPasswordReset(
            {
                email: 'user@example.com',
                token: RAW_TOKEN,
                newPassword: NEW_PASSWORD,
            },
            dependencies
        );

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('invalid_token');
    });

    it('returns invalid_token error when the user has no password hash', async () => {
        const { dependencies } = makeDependencies({
            user: { ...user, passwordHash: null },
        });

        const result = await confirmPasswordReset(
            {
                email: 'user@example.com',
                token: RAW_TOKEN,
                newPassword: NEW_PASSWORD,
            },
            dependencies
        );

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('invalid_token');
    });

    it('returns same_password error and does not consume the token', async () => {
        const { dependencies, consumeToken, updatePassword, verifyPassword } =
            makeDependencies({ isSamePassword: true });

        const result = await confirmPasswordReset(
            {
                email: 'user@example.com',
                token: RAW_TOKEN,
                newPassword: NEW_PASSWORD,
            },
            dependencies
        );

        expect(result).toEqual({
            ok: false,
            error: {
                code: 'same_password',
                message:
                    '현재 비밀번호와 동일한 비밀번호는 사용할 수 없습니다.',
            },
        });
        expect(verifyPassword).toHaveBeenCalledWith(NEW_PASSWORD, 'old-hash');
        expect(consumeToken).not.toHaveBeenCalled();
        expect(updatePassword).not.toHaveBeenCalled();
    });

    it('returns invalid_token when updatePassword fails', async () => {
        const { dependencies } = makeDependencies({
            updatePasswordResult: false,
        });

        const result = await confirmPasswordReset(
            {
                email: 'user@example.com',
                token: RAW_TOKEN,
                newPassword: NEW_PASSWORD,
            },
            dependencies
        );

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('invalid_token');
    });

    it('pre-validates then atomically consumes the token before any password update on success', async () => {
        const {
            dependencies,
            getToken,
            consumeToken,
            updatePassword,
            hashPassword,
            verifyPassword,
        } = makeDependencies();

        // Track call order: get (pre-validate) → verify → consume (atomic) → hash → update.
        const callOrder: string[] = [];
        getToken.mockImplementation(async () => {
            callOrder.push('get');
            return VALID_TOKEN_VALUE;
        });
        verifyPassword.mockImplementation(async () => {
            callOrder.push('verify');
            return false;
        });
        consumeToken.mockImplementation(async () => {
            callOrder.push('consume');
            return VALID_TOKEN_VALUE;
        });
        hashPassword.mockImplementation(async () => {
            callOrder.push('hash');
            return 'new-hashed-password';
        });
        updatePassword.mockImplementation(async () => {
            callOrder.push('update');
            return true;
        });

        const result = await confirmPasswordReset(
            {
                email: ' User@Example.COM ',
                token: RAW_TOKEN,
                newPassword: NEW_PASSWORD,
            },
            dependencies
        );

        expect(result).toEqual({ ok: true });
        expect(getToken).toHaveBeenCalledWith(
            'password_reset',
            'user@example.com'
        );
        expect(consumeToken).toHaveBeenCalledWith(
            'password_reset',
            'user@example.com'
        );
        expect(verifyPassword).toHaveBeenCalledWith(NEW_PASSWORD, 'old-hash');
        expect(hashPassword).toHaveBeenCalledWith(NEW_PASSWORD);
        expect(updatePassword).toHaveBeenCalledWith(
            'user-1',
            'new-hashed-password'
        );
        expect(callOrder).toEqual([
            'get',
            'verify',
            'consume',
            'hash',
            'update',
        ]);
    });

    it('only one of two concurrent consumers updates the password', async () => {
        // Simulate the atomic semantics: the first consume returns the value,
        // every subsequent consume on the same key returns null. Both callers
        // share the same dependency container; only the winning caller should
        // reach updatePassword.
        const { dependencies, consumeToken, updatePassword } =
            makeDependencies();
        let consumed = false;
        consumeToken.mockImplementation(async () => {
            if (consumed) return null;
            consumed = true;
            return VALID_TOKEN_VALUE;
        });

        const [resultA, resultB] = await Promise.all([
            confirmPasswordReset(
                {
                    email: 'user@example.com',
                    token: RAW_TOKEN,
                    newPassword: NEW_PASSWORD,
                },
                dependencies
            ),
            confirmPasswordReset(
                {
                    email: 'user@example.com',
                    token: RAW_TOKEN,
                    newPassword: NEW_PASSWORD,
                },
                dependencies
            ),
        ]);

        const successes = [resultA, resultB].filter(r => r.ok);
        const failures = [resultA, resultB].filter(r => !r.ok);
        expect(successes).toHaveLength(1);
        expect(failures).toHaveLength(1);
        const failure = failures[0];
        if (failure && !failure.ok) {
            expect(failure.error.code).toBe('expired_token');
        }
        expect(updatePassword).toHaveBeenCalledTimes(1);
    });

    describe('남용 한도와 로그인 잠금 해제', () => {
        it('counts the per-IP confirm rule with the agreed numbers', async () => {
            const { dependencies, limiter } = makeDependencies();

            await confirmPasswordReset(
                {
                    email: 'user@example.com',
                    token: RAW_TOKEN,
                    newPassword: NEW_PASSWORD,
                },
                dependencies
            );

            expect(PASSWORD_RESET_RATE_LIMITS.confirmPerIp).toEqual({
                limit: 20,
                windowSeconds: 1800,
            });
            expect(
                limiter.calls.find(rule => rule.key === CONFIRM_IP_KEY)
            ).toMatchObject({ limit: 20, windowSeconds: 1800 });
        });

        it('returns rate_limited without reading the token when the IP rule blocks', async () => {
            const { dependencies, getToken, consumeToken, updatePassword } =
                makeDependencies({ blockKey: CONFIRM_IP_KEY });

            const result = await confirmPasswordReset(
                {
                    email: 'user@example.com',
                    token: RAW_TOKEN,
                    newPassword: NEW_PASSWORD,
                },
                dependencies
            );

            expect(result).toMatchObject({
                ok: false,
                error: { code: 'rate_limited' },
            });
            expect(getToken).not.toHaveBeenCalled();
            expect(consumeToken).not.toHaveBeenCalled();
            expect(updatePassword).not.toHaveBeenCalled();
        });

        it('does not count a password that fails validation', async () => {
            const { dependencies, limiter } = makeDependencies();

            await confirmPasswordReset(
                {
                    email: 'user@example.com',
                    token: RAW_TOKEN,
                    newPassword: 'abc',
                },
                dependencies
            );

            expect(limiter.calls).toHaveLength(0);
        });

        it('has no per-address rule: only the confirm IP key is counted', async () => {
            const { dependencies, limiter } = makeDependencies();

            await confirmPasswordReset(
                {
                    email: 'user@example.com',
                    token: RAW_TOKEN,
                    newPassword: NEW_PASSWORD,
                },
                dependencies
            );

            expect(limiter.calls.map(rule => rule.key)).toEqual([
                CONFIRM_IP_KEY,
            ]);
        });

        it('clears the login lock of the address and of this IP pair on success', async () => {
            const { dependencies, limiter } = makeDependencies();
            await limiter.rateLimit({ key: LOGIN_EMAIL_KEY, ...LOGIN_RULE });
            await limiter.rateLimit({ key: LOGIN_PAIR_KEY, ...LOGIN_RULE });

            const result = await confirmPasswordReset(
                {
                    email: 'user@example.com',
                    token: RAW_TOKEN,
                    newPassword: NEW_PASSWORD,
                },
                dependencies
            );

            expect(result).toEqual({ ok: true });
            expect(limiter.count(LOGIN_EMAIL_KEY)).toBe(0);
            expect(limiter.count(LOGIN_PAIR_KEY)).toBe(0);
        });

        it('keeps the login lock of another IP pair', async () => {
            const { dependencies, limiter } = makeDependencies();
            const otherPair = `auth:login:ei:${hashEmailToken(`${EMAIL_HASH}:other`)}`;
            await limiter.rateLimit({ key: otherPair, ...LOGIN_RULE });

            await confirmPasswordReset(
                {
                    email: 'user@example.com',
                    token: RAW_TOKEN,
                    newPassword: NEW_PASSWORD,
                },
                dependencies
            );

            expect(limiter.count(otherPair)).toBe(1);
        });

        it('still reports success when releasing the lock fails', async () => {
            const { dependencies } = makeDependencies();
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const failing = {
                ...dependencies,
                resetCounter: vi
                    .fn()
                    .mockRejectedValue(new Error('redis down')),
            };

            const result = await confirmPasswordReset(
                {
                    email: 'user@example.com',
                    token: RAW_TOKEN,
                    newPassword: NEW_PASSWORD,
                },
                failing
            );

            expect(result).toEqual({ ok: true });
            expect(warn).toHaveBeenCalled();
            warn.mockRestore();
        });

        it.each([
            ['an invalid token', { peekedToken: null }],
            ['the same password', { isSamePassword: true }],
            ['a failed update', { updatePasswordResult: false }],
        ] as const)(
            'clears nothing when the reset fails with %s',
            async (_name, options) => {
                const { dependencies, limiter } = makeDependencies(options);
                await limiter.rateLimit({
                    key: LOGIN_EMAIL_KEY,
                    ...LOGIN_RULE,
                });
                await limiter.rateLimit({ key: LOGIN_PAIR_KEY, ...LOGIN_RULE });

                const result = await confirmPasswordReset(
                    {
                        email: 'user@example.com',
                        token: RAW_TOKEN,
                        newPassword: NEW_PASSWORD,
                    },
                    dependencies
                );

                expect(result.ok).toBe(false);
                expect(limiter.count(LOGIN_EMAIL_KEY)).toBe(1);
                expect(limiter.count(LOGIN_PAIR_KEY)).toBe(1);
            }
        );
    });
});
