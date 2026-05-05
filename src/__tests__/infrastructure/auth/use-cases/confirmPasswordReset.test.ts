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

function makeDependencies(options?: {
    storedToken?: EmailTokenValue | null;
    user?: EmailAuthUserRecord | null;
    updatePasswordResult?: boolean;
    hashedNewPassword?: string;
    isSamePassword?: boolean;
}): {
    dependencies: ConfirmPasswordResetDependencies;
    consumeToken: ReturnType<typeof jest.fn>;
    findEmailAuthUserByEmail: ReturnType<typeof jest.fn>;
    updatePassword: ReturnType<typeof jest.fn>;
    hashPassword: ReturnType<typeof jest.fn>;
    verifyPassword: ReturnType<typeof jest.fn>;
} {
    const defaultStored: EmailTokenValue = {
        status: 'pending',
        tokenHash: STORED_TOKEN_HASH,
    };
    const storedToken: EmailTokenValue | null =
        options && 'storedToken' in options
            ? (options.storedToken ?? null)
            : defaultStored;
    const foundUser = options && 'user' in options ? options.user : user;
    const updateResult = options?.updatePasswordResult ?? true;
    const hashed = options?.hashedNewPassword ?? 'new-hashed-password';
    const samePassword = options?.isSamePassword ?? false;

    const consumeToken = jest
        .fn<
            Promise<EmailTokenValue | null>,
            [purpose: EmailTokenPurpose, email: string]
        >()
        .mockResolvedValue(storedToken);
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
                get: jest.fn(),
                delete: jest.fn(),
                consume: consumeToken,
            },
            passwordHasher: { hashPassword },
            passwordVerifier: { verifyPassword },
        },
        consumeToken,
        findEmailAuthUserByEmail,
        updatePassword,
        hashPassword,
        verifyPassword,
    };
}

describe('confirmPasswordReset', () => {
    it('returns weak_password error when password fails validation', async () => {
        const { dependencies, consumeToken, updatePassword } =
            makeDependencies();

        const result = await confirmPasswordReset(
            { email: 'user@example.com', token: RAW_TOKEN, newPassword: 'abc' },
            dependencies
        );

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('weak_password');
        expect(consumeToken).not.toHaveBeenCalled();
        expect(updatePassword).not.toHaveBeenCalled();
    });

    it('returns expired_token error when consume returns null', async () => {
        const { dependencies, updatePassword } = makeDependencies({
            storedToken: null,
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

    it('returns invalid_token error when consumed entry is in verified state', async () => {
        const { dependencies } = makeDependencies({
            storedToken: { status: 'verified' },
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

    it('returns invalid_token error when the supplied token does not match', async () => {
        const { dependencies, updatePassword } = makeDependencies();

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
        // The token has already been consumed atomically — there's no extra delete to make.
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

    it('atomically consumes the token before any password update on success', async () => {
        const {
            dependencies,
            consumeToken,
            updatePassword,
            hashPassword,
            verifyPassword,
        } = makeDependencies();

        // Track call order: consume must happen before verify/hash/updatePassword.
        const callOrder: string[] = [];
        consumeToken.mockImplementation(async () => {
            callOrder.push('consume');
            return { status: 'pending', tokenHash: STORED_TOKEN_HASH };
        });
        verifyPassword.mockImplementation(async () => {
            callOrder.push('verify');
            return false;
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
        expect(callOrder).toEqual(['verify', 'consume', 'hash', 'update']);
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
            return { status: 'pending', tokenHash: STORED_TOKEN_HASH };
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
