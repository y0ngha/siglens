import { confirmPasswordReset } from '@/infrastructure/auth/use-cases/confirmPasswordReset';
import type { ConfirmPasswordResetDependencies } from '@/infrastructure/auth/use-cases/types';
import { hashEmailToken } from '@/infrastructure/auth/tokenUtils';
import type {
    EmailTokenPurpose,
    EmailTokenValue,
} from '@/infrastructure/email/tokenStore';
import type { EmailAuthUserRecord } from '@/infrastructure/db/types';

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
}): {
    dependencies: ConfirmPasswordResetDependencies;
    getToken: ReturnType<typeof jest.fn>;
    consumeToken: ReturnType<typeof jest.fn>;
    findEmailAuthUserByEmail: ReturnType<typeof jest.fn>;
    updatePassword: ReturnType<typeof jest.fn>;
    hashPassword: ReturnType<typeof jest.fn>;
    verifyPassword: ReturnType<typeof jest.fn>;
} {
    const peeked =
        options && 'peekedToken' in options
            ? (options.peekedToken ?? null)
            : VALID_TOKEN_VALUE;
    const consumed =
        options && 'consumedToken' in options
            ? (options.consumedToken ?? null)
            : peeked;
    const foundUser = options && 'user' in options ? options.user : user;
    const updateResult = options?.updatePasswordResult ?? true;
    const hashed = options?.hashedNewPassword ?? 'new-hashed-password';
    const samePassword = options?.isSamePassword ?? false;

    const getToken = jest
        .fn<
            Promise<EmailTokenValue | null>,
            [purpose: EmailTokenPurpose, email: string]
        >()
        .mockResolvedValue(peeked);
    const consumeToken = jest
        .fn<
            Promise<EmailTokenValue | null>,
            [purpose: EmailTokenPurpose, email: string]
        >()
        .mockResolvedValue(consumed);
    const findEmailAuthUserByEmail = jest.fn().mockResolvedValue(foundUser);
    const updatePassword = jest.fn().mockResolvedValue(updateResult);
    const hashPassword = jest.fn().mockResolvedValue(hashed);
    const verifyPassword = jest.fn().mockResolvedValue(samePassword);

    return {
        dependencies: {
            emailAuthUsers: { findEmailAuthUserByEmail },
            users: {
                findByEmail: jest.fn(),
                findById: jest.fn(),
                createEmailUser: jest.fn(),
                deleteUser: jest.fn(),
                updatePassword,
            },
            emailTokens: {
                set: jest.fn(),
                get: getToken,
                delete: jest.fn(),
                consume: consumeToken,
            },
            passwordHasher: { hashPassword },
            passwordVerifier: { verifyPassword },
        },
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
        const { dependencies, consumeToken, updatePassword } = makeDependencies({
            peekedToken: null,
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
            peekedToken: { status: 'verified' },
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
        const { dependencies, consumeToken, updatePassword } = makeDependencies();

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
                message: '현재 비밀번호와 동일한 비밀번호는 사용할 수 없습니다.',
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
        expect(getToken).toHaveBeenCalledWith('password_reset', 'user@example.com');
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
        expect(callOrder).toEqual(['get', 'verify', 'consume', 'hash', 'update']);
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
});
