jest.mock('@/infrastructure/db/userRepository');
jest.mock('@/infrastructure/db/agreementRepository');

import { registerUser } from '@/infrastructure/auth/use-cases/registerUser';
import type { RegisterUserDependencies } from '@/infrastructure/auth/use-cases/types';
import { DrizzleUserRepository } from '@/infrastructure/db/userRepository';
import { DrizzleAgreementRepository } from '@/infrastructure/db/agreementRepository';
import type {
    EmailTokenPurpose,
    EmailTokenValue,
} from '@/infrastructure/email/tokenStore';
import type { AuthUserRecord } from '@/domain/auth/types';

const MockUserRepo = DrizzleUserRepository as jest.MockedClass<
    typeof DrizzleUserRepository
>;
const MockAgreementRepo = DrizzleAgreementRepository as jest.MockedClass<
    typeof DrizzleAgreementRepository
>;

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
    findByEmail: ReturnType<typeof jest.fn>;
    createEmailUser: ReturnType<typeof jest.fn>;
    hashPassword: ReturnType<typeof jest.fn>;
    getToken: ReturnType<typeof jest.fn>;
    deleteToken: ReturnType<typeof jest.fn>;
    insertMany: ReturnType<typeof jest.fn>;
    transaction: ReturnType<typeof jest.fn>;
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
    const insertMany = jest.fn().mockResolvedValue(undefined);
    const transaction = jest
        .fn()
        .mockImplementation(
            async (cb: (tx: unknown) => Promise<unknown>) => cb({})
        );

    // Repo classes are instantiated inside the transaction with tx — set up
    // the class mocks so any new DrizzleUserRepository(tx) returns our stubs.
    MockUserRepo.mockImplementation(
        () =>
            ({
                createEmailUser,
                findByEmail,
                findById: jest.fn(),
                deleteUser: jest.fn(),
                updatePassword: jest.fn(),
            }) as unknown as InstanceType<typeof DrizzleUserRepository>
    );
    MockAgreementRepo.mockImplementation(
        () =>
            ({ insertMany }) as unknown as InstanceType<
                typeof DrizzleAgreementRepository
            >
    );

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
                consume: jest.fn(),
            },
            db: { transaction },
        },
        findByEmail,
        createEmailUser,
        hashPassword,
        getToken,
        deleteToken,
        insertMany,
        transaction,
    };
}

const DEFAULT_INPUT = {
    email: 'user@example.com',
    password: 'Password1',
    agreedTermsIds: ['terms-privacy-id', 'terms-tos-id'],
} as const;

describe('registerUser', () => {
    beforeEach(() => {
        MockUserRepo.mockClear();
        MockAgreementRepo.mockClear();
    });

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
        // Marker MUST stay so the user doesn't have to re-verify.
        expect(deleteToken).not.toHaveBeenCalled();
    });

    it('clears the verified marker when createEmailUser throws', async () => {
        const { dependencies, deleteToken, createEmailUser } = makeDependencies();
        (createEmailUser as jest.Mock).mockRejectedValueOnce(new Error('database is on fire'));

        await expect(
            registerUser(DEFAULT_INPUT, dependencies)
        ).rejects.toThrow('database is on fire');

        // Even on failure, the marker MUST be cleared; otherwise it would linger
        // for its 30-minute TTL and let the email be reused as "verified".
        expect(deleteToken).toHaveBeenCalledWith(
            'email_verification',
            'user@example.com'
        );
    });

    it('clears the verified marker when hashPassword throws', async () => {
        const { dependencies, deleteToken } = makeDependencies();
        (
            dependencies.passwordHasher.hashPassword as jest.Mock
        ).mockRejectedValueOnce(new Error('hash failure'));

        await expect(
            registerUser(DEFAULT_INPUT, dependencies)
        ).rejects.toThrow('hash failure');

        expect(deleteToken).toHaveBeenCalledWith(
            'email_verification',
            'user@example.com'
        );
    });

    it('returns email_already_exists when createEmailUser races to a conflict', async () => {
        const { dependencies, createEmailUser } = makeDependencies({
            createdUser: null,
        });
        (createEmailUser as jest.Mock).mockResolvedValue(null);

        const result = await registerUser(DEFAULT_INPUT, dependencies);

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('email_already_exists');
    });

    it('inserts agreement rows for each agreedTermsId using tx inside a transaction', async () => {
        const { dependencies, insertMany, transaction } = makeDependencies();

        const result = await registerUser(DEFAULT_INPUT, dependencies);

        expect(result.ok).toBe(true);
        expect(transaction).toHaveBeenCalledTimes(1);
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
