import { confirmPasswordReset } from '@/entities/user/lib/confirmPasswordReset';
import { hashEmailToken } from '@/entities/session/lib/tokenUtils';
import type { ConfirmPasswordResetDependencies } from '@/entities/user/lib/authUseCaseTypes';

function createMockDependencies(
    overrides: Partial<{
        emailTokens: Partial<ConfirmPasswordResetDependencies['emailTokens']>;
        emailAuthUsers: Partial<
            ConfirmPasswordResetDependencies['emailAuthUsers']
        >;
        users: Partial<ConfirmPasswordResetDependencies['users']>;
        passwordHasher: Partial<
            ConfirmPasswordResetDependencies['passwordHasher']
        >;
        passwordVerifier: Partial<
            ConfirmPasswordResetDependencies['passwordVerifier']
        >;
    }> = {}
): ConfirmPasswordResetDependencies {
    return {
        emailTokens: {
            get: vi.fn().mockResolvedValue(null),
            set: vi.fn().mockResolvedValue(undefined),
            delete: vi.fn().mockResolvedValue(undefined),
            consume: vi.fn().mockResolvedValue(null),
            ...overrides.emailTokens,
        } as unknown as ConfirmPasswordResetDependencies['emailTokens'],
        emailAuthUsers: {
            findEmailAuthUserByEmail: vi.fn().mockResolvedValue(null),
            ...overrides.emailAuthUsers,
        } as unknown as ConfirmPasswordResetDependencies['emailAuthUsers'],
        users: {
            updatePassword: vi.fn().mockResolvedValue(true),
            ...overrides.users,
        } as unknown as ConfirmPasswordResetDependencies['users'],
        passwordHasher: {
            hashPassword: vi.fn().mockResolvedValue('new-hash'),
            ...overrides.passwordHasher,
        } as unknown as ConfirmPasswordResetDependencies['passwordHasher'],
        passwordVerifier: {
            verifyPassword: vi.fn().mockResolvedValue(false),
            ...overrides.passwordVerifier,
        } as unknown as ConfirmPasswordResetDependencies['passwordVerifier'],
    };
}

const VALID_TOKEN = 'valid-reset-token-abc123';
const VALID_INPUT = {
    email: 'test@example.com',
    token: VALID_TOKEN,
    newPassword: 'NewSecurePassword123!',
};

describe('Password reset edge cases', () => {
    it('returns expired error when no token stored', async () => {
        const deps = createMockDependencies({
            emailTokens: {
                get: vi.fn().mockResolvedValue(null),
            },
        });

        const result = await confirmPasswordReset(VALID_INPUT, deps);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('expired_token');
        }
    });

    it('returns invalid error when token hash does not match', async () => {
        const deps = createMockDependencies({
            emailTokens: {
                get: vi.fn().mockResolvedValue({
                    status: 'pending',
                    tokenHash: hashEmailToken('different-token'),
                }),
            },
        });

        const result = await confirmPasswordReset(VALID_INPUT, deps);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('invalid_token');
        }
    });

    it('returns invalid error when token status is not pending', async () => {
        const deps = createMockDependencies({
            emailTokens: {
                get: vi.fn().mockResolvedValue({
                    status: 'verified',
                    tokenHash: hashEmailToken(VALID_TOKEN),
                }),
            },
        });

        const result = await confirmPasswordReset(VALID_INPUT, deps);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('invalid_token');
        }
    });

    it('returns invalid error when user not found', async () => {
        const deps = createMockDependencies({
            emailTokens: {
                get: vi.fn().mockResolvedValue({
                    status: 'pending',
                    tokenHash: hashEmailToken(VALID_TOKEN),
                }),
            },
            emailAuthUsers: {
                findEmailAuthUserByEmail: vi.fn().mockResolvedValue(null),
            },
        });

        const result = await confirmPasswordReset(VALID_INPUT, deps);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('invalid_token');
        }
    });

    it('returns same_password error when new password matches current', async () => {
        const deps = createMockDependencies({
            emailTokens: {
                get: vi.fn().mockResolvedValue({
                    status: 'pending',
                    tokenHash: hashEmailToken(VALID_TOKEN),
                }),
            },
            emailAuthUsers: {
                findEmailAuthUserByEmail: vi.fn().mockResolvedValue({
                    id: 'user-1',
                    passwordHash: 'existing-hash',
                }),
            },
            passwordVerifier: {
                verifyPassword: vi.fn().mockResolvedValue(true),
            },
        });

        const result = await confirmPasswordReset(VALID_INPUT, deps);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('same_password');
        }
    });

    it('returns expired error when consume returns null (race condition)', async () => {
        const deps = createMockDependencies({
            emailTokens: {
                get: vi.fn().mockResolvedValue({
                    status: 'pending',
                    tokenHash: hashEmailToken(VALID_TOKEN),
                }),
                consume: vi.fn().mockResolvedValue(null),
            },
            emailAuthUsers: {
                findEmailAuthUserByEmail: vi.fn().mockResolvedValue({
                    id: 'user-1',
                    passwordHash: 'existing-hash',
                }),
            },
        });

        const result = await confirmPasswordReset(VALID_INPUT, deps);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('expired_token');
        }
    });

    it('validates password format before anything else', async () => {
        const deps = createMockDependencies();

        const result = await confirmPasswordReset(
            { ...VALID_INPUT, newPassword: '12' },
            deps
        );

        expect(result.ok).toBe(false);
        expect(deps.emailTokens.get).not.toHaveBeenCalled();
    });
});
