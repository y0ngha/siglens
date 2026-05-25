import { registerUser } from '@/entities/user/lib/registerUser';
import type {
    RegisterUserDependencies,
    RegisterUserInput,
} from '@/entities/user/lib/authUseCaseTypes';

function createMockDependencies(
    overrides: Partial<RegisterUserDependencies> = {}
): RegisterUserDependencies {
    return {
        users: {
            findByEmail: vi.fn().mockResolvedValue(null),
            createEmailUser: vi.fn().mockResolvedValue({
                id: 'user-1',
                email: 'test@example.com',
                name: null,
                avatarUrl: null,
                emailVerified: true,
                createdAt: new Date(),
            }),
            deleteUser: vi.fn().mockResolvedValue(true),
            ...overrides.users,
        } as unknown as RegisterUserDependencies['users'],
        agreements: {
            insertMany: vi.fn().mockResolvedValue(undefined),
            ...overrides.agreements,
        } as unknown as RegisterUserDependencies['agreements'],
        passwordHasher: {
            hashPassword: vi.fn().mockResolvedValue('hashed-password'),
            ...overrides.passwordHasher,
        } as unknown as RegisterUserDependencies['passwordHasher'],
        emailTokens: {
            get: vi.fn().mockResolvedValue({ status: 'verified' }),
            delete: vi.fn().mockResolvedValue(undefined),
            ...overrides.emailTokens,
        } as unknown as RegisterUserDependencies['emailTokens'],
    };
}

const VALID_INPUT: RegisterUserInput = {
    email: 'Test@Example.com',
    password: 'SecurePassword123!',
    name: 'Test User',
    agreedTermsIds: ['terms-v1'],
};

describe('registerUser compensating transaction', () => {
    it('deletes user when agreements INSERT fails', async () => {
        const agreementsError = new Error('DB constraint violation');
        const deps = createMockDependencies({
            agreements: {
                insertMany: vi.fn().mockRejectedValue(agreementsError),
            } as unknown as RegisterUserDependencies['agreements'],
        });

        await expect(registerUser(VALID_INPUT, deps)).rejects.toThrow(
            'DB constraint violation'
        );

        expect(deps.users.deleteUser).toHaveBeenCalledWith('user-1');
    });

    it('logs warning when compensating delete also fails', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const deps = createMockDependencies({
            agreements: {
                insertMany: vi.fn().mockRejectedValue(new Error('insert fail')),
            } as unknown as RegisterUserDependencies['agreements'],
            users: {
                findByEmail: vi.fn().mockResolvedValue(null),
                createEmailUser: vi.fn().mockResolvedValue({
                    id: 'user-1',
                    email: 'test@example.com',
                    name: null,
                    avatarUrl: null,
                    emailVerified: true,
                    createdAt: new Date(),
                }),
                deleteUser: vi.fn().mockRejectedValue(new Error('delete fail')),
            } as unknown as RegisterUserDependencies['users'],
        });

        await expect(registerUser(VALID_INPUT, deps)).rejects.toThrow(
            'insert fail'
        );

        expect(warnSpy).toHaveBeenCalledWith(
            '[registerUser] compensating delete failed — user row may be orphaned',
            expect.any(Error)
        );
    });

    it('returns email_already_exists when createEmailUser returns null (race)', async () => {
        const deps = createMockDependencies({
            users: {
                findByEmail: vi.fn().mockResolvedValue(null),
                createEmailUser: vi.fn().mockResolvedValue(null),
                deleteUser: vi.fn(),
            } as unknown as RegisterUserDependencies['users'],
        });

        const result = await registerUser(VALID_INPUT, deps);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('email_already_exists');
        }
    });

    it('returns error for empty agreedTermsIds', async () => {
        const deps = createMockDependencies();
        const result = await registerUser(
            { ...VALID_INPUT, agreedTermsIds: [] },
            deps
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('invalid_input');
        }
    });

    it('returns error when email verification is not completed', async () => {
        const deps = createMockDependencies({
            emailTokens: {
                get: vi.fn().mockResolvedValue(null),
                delete: vi.fn(),
            } as unknown as RegisterUserDependencies['emailTokens'],
        });

        const result = await registerUser(VALID_INPUT, deps);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('email_not_verified');
        }
    });

    it('propagates bcrypt hashPassword failure', async () => {
        const deps = createMockDependencies({
            passwordHasher: {
                hashPassword: vi
                    .fn()
                    .mockRejectedValue(new Error('bcrypt failed')),
            } as unknown as RegisterUserDependencies['passwordHasher'],
        });

        await expect(registerUser(VALID_INPUT, deps)).rejects.toThrow(
            'bcrypt failed'
        );
    });
});
