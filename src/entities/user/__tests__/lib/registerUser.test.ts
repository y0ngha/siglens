import type { Mock } from 'vitest';
import { registerUser } from '@/entities/user/lib/registerUser';
import type { RegisterUserDependencies } from '@/entities/user/lib/authUseCaseTypes';
import type {
    EmailTokenPurpose,
    EmailTokenValue,
} from '@/entities/email-token/api';
import type { AuthUserRecord } from '@/shared/lib/auth/types';

const createdAt = new Date('2026-04-26T00:00:00.000Z');
const updatedAt = new Date('2026-04-26T00:00:01.000Z');

function makeUser(email: string = 'user@example.com'): AuthUserRecord {
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
    findByEmail: ReturnType<typeof vi.fn>;
    createEmailUser: ReturnType<typeof vi.fn>;
    deleteUser: ReturnType<typeof vi.fn>;
    hashPassword: ReturnType<typeof vi.fn>;
    getToken: ReturnType<typeof vi.fn>;
    deleteToken: ReturnType<typeof vi.fn>;
    insertMany: ReturnType<typeof vi.fn>;
} {
    const findByEmail = vi
        .fn()
        .mockResolvedValue(options?.existingUser ?? null);
    const createdUser =
        options && 'createdUser' in options
            ? options.createdUser
            : makeUser('user@example.com');
    const createEmailUser = vi.fn().mockResolvedValue(createdUser);
    const deleteUser = vi.fn().mockResolvedValue(true);
    const hashPassword = vi.fn().mockResolvedValue('hashed-password');

    const verificationState =
        options && 'verificationState' in options
            ? (options.verificationState ?? null)
            : ({ status: 'verified' } satisfies EmailTokenValue);
    const getToken = vi
        .fn<
            (
                purpose: EmailTokenPurpose,
                email: string
            ) => Promise<EmailTokenValue | null>
        >()
        .mockResolvedValue(verificationState);
    const deleteToken = vi.fn().mockResolvedValue(undefined);
    const insertMany = vi.fn().mockResolvedValue(undefined);

    return {
        dependencies: {
            users: {
                findByEmail,
                findById: vi.fn(),
                createEmailUser,
                deleteUser,
                updatePassword: vi.fn(),
            },
            agreements: { insertMany },
            passwordHasher: { hashPassword },
            emailTokens: {
                set: vi.fn(),
                get: getToken,
                delete: deleteToken,
                consume: vi.fn(),
            },
        },
        findByEmail,
        createEmailUser,
        deleteUser,
        hashPassword,
        getToken,
        deleteToken,
        insertMany,
    };
}

const DEFAULT_INPUT = {
    email: 'user@example.com',
    password: 'Password1',
    agreedTermsIds: ['terms-privacy-id', 'terms-tos-id'],
} as const;

describe('registerUser', () => {
    it('rejects empty agreedTermsIds before any further processing', async () => {
        const { dependencies, findByEmail, hashPassword, getToken } =
            makeDependencies();

        const result = await registerUser(
            { ...DEFAULT_INPUT, agreedTermsIds: [] },
            dependencies
        );

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('invalid_input');
        expect(findByEmail).not.toHaveBeenCalled();
        expect(hashPassword).not.toHaveBeenCalled();
        expect(getToken).not.toHaveBeenCalled();
    });

    it('rejects invalid email before repository access', async () => {
        const { dependencies, findByEmail, hashPassword, getToken } =
            makeDependencies();

        const result = await registerUser(
            { ...DEFAULT_INPUT, email: 'invalid-email' },
            dependencies
        );

        expect(result).toEqual({
            ok: false,
            error: {
                code: 'invalid_email',
                field: 'email',
                message: '올바른 이메일 형식이 아닙니다.',
            },
        });
        expect(findByEmail).not.toHaveBeenCalled();
        expect(hashPassword).not.toHaveBeenCalled();
        expect(getToken).not.toHaveBeenCalled();
    });

    it('rejects weak password before repository access', async () => {
        const { dependencies, findByEmail } = makeDependencies();

        const result = await registerUser(
            { ...DEFAULT_INPUT, password: 'short' },
            dependencies
        );

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('weak_password');
        expect(findByEmail).not.toHaveBeenCalled();
    });

    it('rejects when no email-verification entry exists', async () => {
        const { dependencies, findByEmail } = makeDependencies({
            verificationState: null,
        });

        const result = await registerUser(DEFAULT_INPUT, dependencies);

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('email_not_verified');
        expect(findByEmail).not.toHaveBeenCalled();
    });

    it('rejects when verification entry is still in pending state', async () => {
        const { dependencies } = makeDependencies({
            verificationState: { status: 'pending', tokenHash: 'hash' },
        });

        const result = await registerUser(DEFAULT_INPUT, dependencies);

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('email_not_verified');
    });

    it('rejects when the email is already registered', async () => {
        const { dependencies } = makeDependencies({
            existingUser: makeUser('user@example.com'),
        });

        const result = await registerUser(DEFAULT_INPUT, dependencies);

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('email_already_exists');
    });

    it('preserves the verified marker on email_already_exists so the user can retry', async () => {
        const { dependencies, deleteToken } = makeDependencies({
            existingUser: makeUser('user@example.com'),
        });

        const result = await registerUser(DEFAULT_INPUT, dependencies);

        expect(result.ok).toBe(false);
        expect(deleteToken).not.toHaveBeenCalled();
    });

    it('preserves the verified marker when hashPassword throws', async () => {
        const { dependencies, deleteToken } = makeDependencies();
        (
            dependencies.passwordHasher.hashPassword as Mock
        ).mockRejectedValueOnce(new Error('hash failure'));

        await expect(registerUser(DEFAULT_INPUT, dependencies)).rejects.toThrow(
            'hash failure'
        );

        // On failure the marker must be preserved so the user can retry without re-verifying.
        expect(deleteToken).not.toHaveBeenCalled();
    });

    it('preserves the verified marker when createEmailUser throws', async () => {
        const { dependencies, deleteToken, createEmailUser } =
            makeDependencies();
        (createEmailUser as Mock).mockRejectedValueOnce(
            new Error('database is on fire')
        );

        await expect(registerUser(DEFAULT_INPUT, dependencies)).rejects.toThrow(
            'database is on fire'
        );

        // On failure the marker must be preserved so the user can retry without re-verifying.
        expect(deleteToken).not.toHaveBeenCalled();
    });

    it('preserves the verified marker when createEmailUser returns null (race conflict)', async () => {
        const { dependencies, deleteToken } = makeDependencies({
            createdUser: null,
        });

        const result = await registerUser(DEFAULT_INPUT, dependencies);

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('email_already_exists');
        // email_already_exists (race) — preserve the marker, consistent with the pre-insert early-return path.
        expect(deleteToken).not.toHaveBeenCalled();
    });

    it('compensates by deleting the user when insertMany throws', async () => {
        const { dependencies, deleteUser, deleteToken, insertMany } =
            makeDependencies();
        (insertMany as Mock).mockRejectedValueOnce(
            new Error('agreements insert failed')
        );

        await expect(registerUser(DEFAULT_INPUT, dependencies)).rejects.toThrow(
            'agreements insert failed'
        );

        expect(deleteUser).toHaveBeenCalledWith('user-1');
        // Verified marker must be preserved so the user can retry without re-verifying.
        expect(deleteToken).not.toHaveBeenCalled();
    });

    it('inserts agreement rows for each agreedTermsId', async () => {
        const { dependencies, insertMany } = makeDependencies();

        const result = await registerUser(DEFAULT_INPUT, dependencies);

        expect(result.ok).toBe(true);
        expect(insertMany).toHaveBeenCalledWith([
            expect.objectContaining({
                termsId: 'terms-privacy-id',
                agreed: true,
            }),
            expect.objectContaining({
                termsId: 'terms-tos-id',
                agreed: true,
            }),
        ]);
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
                ...DEFAULT_INPUT,
                email: ' User@Example.COM ',
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
                ...DEFAULT_INPUT,
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
