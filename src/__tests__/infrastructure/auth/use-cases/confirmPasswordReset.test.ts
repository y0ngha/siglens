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
}): {
    dependencies: ConfirmPasswordResetDependencies;
    getToken: ReturnType<typeof jest.fn>;
    deleteToken: ReturnType<typeof jest.fn>;
    findEmailAuthUserByEmail: ReturnType<typeof jest.fn>;
    updatePassword: ReturnType<typeof jest.fn>;
    hashPassword: ReturnType<typeof jest.fn>;
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

    const getToken = jest
        .fn<
            Promise<EmailTokenValue | null>,
            [purpose: EmailTokenPurpose, email: string]
        >()
        .mockResolvedValue(storedToken);
    const deleteToken = jest.fn().mockResolvedValue(undefined);
    const findEmailAuthUserByEmail = jest.fn().mockResolvedValue(foundUser);
    const updatePassword = jest.fn().mockResolvedValue(updateResult);
    const hashPassword = jest.fn().mockResolvedValue(hashed);

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
                delete: deleteToken,
            },
            passwordHasher: { hashPassword },
        },
        getToken,
        deleteToken,
        findEmailAuthUserByEmail,
        updatePassword,
        hashPassword,
    };
}

describe('confirmPasswordReset', () => {
    it('returns weak_password error when password fails validation', async () => {
        const { dependencies, getToken, updatePassword } = makeDependencies();

        const result = await confirmPasswordReset(
            { email: 'user@example.com', token: RAW_TOKEN, newPassword: 'abc' },
            dependencies
        );

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('weak_password');
        expect(getToken).not.toHaveBeenCalled();
        expect(updatePassword).not.toHaveBeenCalled();
    });

    it('returns expired_token error when no Redis entry exists', async () => {
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
                message: 'Password reset token has expired',
            },
        });
        expect(updatePassword).not.toHaveBeenCalled();
    });

    it('returns invalid_token error when stored entry is in verified state', async () => {
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
        const { dependencies, deleteToken } = makeDependencies();

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
        expect(deleteToken).not.toHaveBeenCalled();
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

    it('returns invalid_token when updatePassword fails', async () => {
        const { dependencies, deleteToken } = makeDependencies({
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
        expect(deleteToken).not.toHaveBeenCalled();
    });

    it('updates the password hash and deletes the Redis entry on success', async () => {
        const {
            dependencies,
            getToken,
            deleteToken,
            updatePassword,
            hashPassword,
        } = makeDependencies();

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
        expect(hashPassword).toHaveBeenCalledWith(NEW_PASSWORD);
        expect(updatePassword).toHaveBeenCalledWith(
            'user-1',
            'new-hashed-password'
        );
        expect(deleteToken).toHaveBeenCalledWith(
            'password_reset',
            'user@example.com'
        );
    });
});
