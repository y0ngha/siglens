import { registerUser } from '@/infrastructure/auth/use-cases/registerUser';
import type { RegisterUserDependencies } from '@/infrastructure/auth/use-cases/types';
import type {
    EmailTokenPurpose,
    EmailTokenValue,
} from '@/infrastructure/email/tokenStore';
import type { AuthUserRecord } from '@/infrastructure/db/types';

const createdAt = new Date('2026-04-26T00:00:00.000Z');
const updatedAt = new Date('2026-04-26T00:00:01.000Z');

function makeUser(email: string): AuthUserRecord {
    return {
        id: 'user-1',
        email,
        name: null,
        avatarUrl: null,
        tier: 'free',
        emailVerified: true,
        createdAt,
        updatedAt,
    };
}

function makeDependencies(options?: {
    existingUser?: AuthUserRecord | null;
    createdUser?: AuthUserRecord | null;
    verificationState?: EmailTokenValue | null;
}): {
    dependencies: RegisterUserDependencies;
    findByEmail: ReturnType<typeof jest.fn>;
    createEmailUser: ReturnType<typeof jest.fn>;
    hashPassword: ReturnType<typeof jest.fn>;
    getToken: ReturnType<typeof jest.fn>;
    deleteToken: ReturnType<typeof jest.fn>;
} {
    const findByEmail = jest
        .fn()
        .mockResolvedValue(options?.existingUser ?? null);
    const createdUser =
        options && 'createdUser' in options
            ? options.createdUser
            : makeUser('user@example.com');
    const createEmailUser = jest.fn().mockResolvedValue(createdUser);
    const hashPassword = jest.fn().mockResolvedValue('hashed-password');

    const verificationState =
        options && 'verificationState' in options
            ? (options.verificationState ?? null)
            : ({ status: 'verified' } satisfies EmailTokenValue);
    const getToken = jest
        .fn<
            Promise<EmailTokenValue | null>,
            [purpose: EmailTokenPurpose, email: string]
        >()
        .mockResolvedValue(verificationState);
    const deleteToken = jest.fn().mockResolvedValue(undefined);

    return {
        dependencies: {
            users: {
                findByEmail,
                findById: jest.fn(),
                createEmailUser,
                deleteUser: jest.fn(),
                updatePassword: jest.fn(),
            },
            passwordHasher: { hashPassword },
            emailTokens: {
                set: jest.fn(),
                get: getToken,
                delete: deleteToken,
            },
        },
        findByEmail,
        createEmailUser,
        hashPassword,
        getToken,
        deleteToken,
    };
}

describe('registerUser', () => {
    it('rejects invalid email before repository access', async () => {
        const { dependencies, findByEmail, hashPassword, getToken } =
            makeDependencies();

        const result = await registerUser(
            { email: 'invalid-email', password: 'Password1' },
            dependencies
        );

        expect(result).toEqual({
            ok: false,
            error: {
                code: 'invalid_email',
                field: 'email',
                message: 'Email format is invalid',
            },
        });
        expect(findByEmail).not.toHaveBeenCalled();
        expect(hashPassword).not.toHaveBeenCalled();
        expect(getToken).not.toHaveBeenCalled();
    });

    it('rejects weak password before repository access', async () => {
        const { dependencies, findByEmail } = makeDependencies();

        const result = await registerUser(
            { email: 'user@example.com', password: 'short' },
            dependencies
        );

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('weak_password');
        expect(findByEmail).not.toHaveBeenCalled();
    });

    it('rejects when no email-verification entry exists', async () => {
        const { dependencies, findByEmail, createEmailUser } = makeDependencies(
            { verificationState: null }
        );

        const result = await registerUser(
            { email: 'user@example.com', password: 'Password1' },
            dependencies
        );

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('email_not_verified');
        expect(findByEmail).not.toHaveBeenCalled();
        expect(createEmailUser).not.toHaveBeenCalled();
    });

    it('rejects when verification entry is still in pending state', async () => {
        const { dependencies, createEmailUser } = makeDependencies({
            verificationState: { status: 'pending', tokenHash: 'hash' },
        });

        const result = await registerUser(
            { email: 'user@example.com', password: 'Password1' },
            dependencies
        );

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('email_not_verified');
        expect(createEmailUser).not.toHaveBeenCalled();
    });

    it('rejects when the email is already registered', async () => {
        const { dependencies, createEmailUser } = makeDependencies({
            existingUser: makeUser('user@example.com'),
        });

        const result = await registerUser(
            { email: 'user@example.com', password: 'Password1' },
            dependencies
        );

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('email_already_exists');
        expect(createEmailUser).not.toHaveBeenCalled();
    });

    it('returns email_already_exists when createEmailUser races to a conflict', async () => {
        const { dependencies } = makeDependencies({ createdUser: null });

        const result = await registerUser(
            { email: 'user@example.com', password: 'Password1' },
            dependencies
        );

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('email_already_exists');
    });

    it('creates the user with emailVerified true and clears the Redis entry on success', async () => {
        const {
            dependencies,
            findByEmail,
            createEmailUser,
            hashPassword,
            getToken,
            deleteToken,
        } = makeDependencies();

        const result = await registerUser(
            {
                email: ' User@Example.COM ',
                password: 'Password1',
                name: '  Ada  ',
                avatarUrl: '  https://avatars.example.com/ada.png  ',
            },
            dependencies
        );

        expect(getToken).toHaveBeenCalledWith(
            'email_verification',
            'user@example.com'
        );
        expect(findByEmail).toHaveBeenCalledWith('user@example.com');
        expect(hashPassword).toHaveBeenCalledWith('Password1');
        expect(createEmailUser).toHaveBeenCalledWith({
            email: 'user@example.com',
            passwordHash: 'hashed-password',
            name: 'Ada',
            avatarUrl: 'https://avatars.example.com/ada.png',
            emailVerified: true,
        });
        expect(deleteToken).toHaveBeenCalledWith(
            'email_verification',
            'user@example.com'
        );
        expect(result.ok).toBe(true);
    });

    it('normalizes blank optional profile fields to null', async () => {
        const { dependencies, createEmailUser } = makeDependencies();

        await registerUser(
            {
                email: 'user@example.com',
                password: 'Password1',
                name: '   ',
                avatarUrl: '   ',
            },
            dependencies
        );

        expect(createEmailUser).toHaveBeenCalledWith({
            email: 'user@example.com',
            passwordHash: 'hashed-password',
            name: null,
            avatarUrl: null,
            emailVerified: true,
        });
    });
});
