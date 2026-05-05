import { oauthAccounts, users } from '@/infrastructure/db/schema';
import { decryptToken } from '@/infrastructure/db/tokenEncryption';
import type { SiglensDatabase } from '@/infrastructure/db/types';
import { DrizzleUserRepository } from '@/infrastructure/db/userRepository';
const VALID_KEY_HEX = 'a'.repeat(64);

const userRecord = {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Ada',
    avatarUrl: null,
    tier: 'free',
    emailVerified: true,
    createdAt: new Date('2026-04-26T00:00:00.000Z'),
    updatedAt: new Date('2026-04-26T00:00:01.000Z'),
};

function makeSelectDb(rows: unknown[]): {
    db: SiglensDatabase;
    select: ReturnType<typeof jest.fn>;
    from: ReturnType<typeof jest.fn>;
    innerJoin: ReturnType<typeof jest.fn>;
    where: ReturnType<typeof jest.fn>;
    limit: ReturnType<typeof jest.fn>;
} {
    const limit = jest.fn().mockResolvedValue(rows);
    const where = jest.fn(() => ({ limit }));
    const innerJoin = jest.fn(() => ({ where }));
    const from = jest.fn(() => ({ innerJoin, where }));
    const select = jest.fn(() => ({ from }));

    return {
        db: { select } as unknown as SiglensDatabase,
        select,
        from,
        innerJoin,
        where,
        limit,
    };
}

function makeInsertDb(rows: unknown[]): {
    db: SiglensDatabase;
    insert: ReturnType<typeof jest.fn>;
    values: ReturnType<typeof jest.fn>;
    onConflictDoNothing: ReturnType<typeof jest.fn>;
    returning: ReturnType<typeof jest.fn>;
} {
    const returning = jest.fn().mockResolvedValue(rows);
    const onConflictDoNothing = jest.fn(() => ({ returning }));
    const values = jest.fn(() => ({ onConflictDoNothing }));
    const insert = jest.fn(() => ({ values }));

    return {
        db: { insert } as unknown as SiglensDatabase,
        insert,
        values,
        onConflictDoNothing,
        returning,
    };
}

function makeDeleteDb(rows: unknown[]): {
    db: SiglensDatabase;
    delete: ReturnType<typeof jest.fn>;
    where: ReturnType<typeof jest.fn>;
    returning: ReturnType<typeof jest.fn>;
} {
    const returning = jest.fn().mockResolvedValue(rows);
    const where = jest.fn(() => ({ returning }));
    const deleteFn = jest.fn(() => ({ where }));

    return {
        db: { delete: deleteFn } as unknown as SiglensDatabase,
        delete: deleteFn,
        where,
        returning,
    };
}

function makeOAuthInsertDb(options: {
    userRows: unknown[];
    accountRows: unknown[];
    deleteRows?: unknown[];
}): {
    db: SiglensDatabase;
    insert: ReturnType<typeof jest.fn>;
    userValues: ReturnType<typeof jest.fn>;
    accountValues: ReturnType<typeof jest.fn>;
    userOnConflictDoNothing: ReturnType<typeof jest.fn>;
    accountOnConflictDoNothing: ReturnType<typeof jest.fn>;
    userReturning: ReturnType<typeof jest.fn>;
    accountReturning: ReturnType<typeof jest.fn>;
    deleteFn: ReturnType<typeof jest.fn>;
    deleteWhere: ReturnType<typeof jest.fn>;
    deleteReturning: ReturnType<typeof jest.fn>;
} {
    const deleteReturning = jest
        .fn()
        .mockResolvedValue(options.deleteRows ?? []);
    const deleteWhere = jest.fn(() => ({ returning: deleteReturning }));
    const deleteFn = jest.fn(() => ({ where: deleteWhere }));

    const userReturning = jest.fn().mockResolvedValue(options.userRows);
    const accountReturning = jest.fn().mockResolvedValue(options.accountRows);
    const userOnConflictDoNothing = jest.fn(() => ({
        returning: userReturning,
    }));
    const accountOnConflictDoNothing = jest.fn(() => ({
        returning: accountReturning,
    }));
    const userValues = jest.fn(() => ({
        onConflictDoNothing: userOnConflictDoNothing,
    }));
    const accountValues = jest.fn(() => ({
        onConflictDoNothing: accountOnConflictDoNothing,
    }));
    const insert = jest
        .fn()
        .mockReturnValueOnce({ values: userValues })
        .mockReturnValueOnce({ values: accountValues });

    return {
        db: { insert, delete: deleteFn } as unknown as SiglensDatabase,
        insert,
        userValues,
        accountValues,
        userOnConflictDoNothing,
        accountOnConflictDoNothing,
        userReturning,
        accountReturning,
        deleteFn,
        deleteWhere,
        deleteReturning,
    };
}

function makeFailingOAuthInsertDb(error: Error): {
    db: SiglensDatabase;
    insert: ReturnType<typeof jest.fn>;
} {
    const returning = jest.fn().mockRejectedValue(error);
    const onConflictDoNothing = jest.fn(() => ({ returning }));
    const values = jest.fn(() => ({ onConflictDoNothing }));
    const insert = jest.fn(() => ({ values }));

    return {
        db: { insert } as unknown as SiglensDatabase,
        insert,
    };
}

function makeUpdateDb(rows: unknown[]): {
    db: SiglensDatabase;
    update: ReturnType<typeof jest.fn>;
    set: ReturnType<typeof jest.fn>;
    where: ReturnType<typeof jest.fn>;
    returning: ReturnType<typeof jest.fn>;
} {
    const returning = jest.fn().mockResolvedValue(rows);
    const where = jest.fn(() => ({ returning }));
    const set = jest.fn(() => ({ where }));
    const update = jest.fn(() => ({ set }));

    return {
        db: { update } as unknown as SiglensDatabase,
        update,
        set,
        where,
        returning,
    };
}

describe('DrizzleUserRepository', () => {
    // createOAuthUser now requires OAUTH_TOKEN_ENCRYPTION_KEY to be present and
    // valid. Tests below that exercise non-OAuth paths are unaffected, but tests
    // that hit createOAuthUser depend on this env var being set. The dedicated
    // "token encryption in createOAuthUser" describe overrides / clears it.
    const ORIGINAL_OAUTH_ENC = process.env['OAUTH_TOKEN_ENCRYPTION_KEY'];

    beforeEach(() => {
        process.env['OAUTH_TOKEN_ENCRYPTION_KEY'] = VALID_KEY_HEX;
    });

    afterEach(() => {
        if (ORIGINAL_OAUTH_ENC === undefined) {
            delete process.env['OAUTH_TOKEN_ENCRYPTION_KEY'];
        } else {
            process.env['OAUTH_TOKEN_ENCRYPTION_KEY'] = ORIGINAL_OAUTH_ENC;
        }
    });

    it('returns a user found by email', async () => {
        const { db, select, from, where, limit } = makeSelectDb([userRecord]);
        const repository = new DrizzleUserRepository(db);

        const result = await repository.findByEmail('user@example.com');

        expect(select).toHaveBeenCalledWith(expect.any(Object));
        expect(from).toHaveBeenCalledWith(expect.any(Object));
        expect(where).toHaveBeenCalledWith(expect.any(Object));
        expect(limit).toHaveBeenCalledWith(1);
        expect(result).toEqual(userRecord);
    });

    it('returns null when no user is found by email', async () => {
        const { db } = makeSelectDb([]);
        const repository = new DrizzleUserRepository(db);

        const result = await repository.findByEmail('missing@example.com');

        expect(result).toBeNull();
    });

    it('returns a user found by id', async () => {
        const { db, select, from, where, limit } = makeSelectDb([userRecord]);
        const repository = new DrizzleUserRepository(db);

        const result = await repository.findById('user-1');

        expect(select).toHaveBeenCalledWith(expect.any(Object));
        expect(from).toHaveBeenCalledWith(expect.any(Object));
        expect(where).toHaveBeenCalledWith(expect.any(Object));
        expect(limit).toHaveBeenCalledWith(1);
        expect(result).toEqual(userRecord);
    });

    it('returns null when no user is found by id', async () => {
        const { db } = makeSelectDb([]);
        const repository = new DrizzleUserRepository(db);

        const result = await repository.findById('missing-user');

        expect(result).toBeNull();
    });

    it('returns true when deleting an existing user', async () => {
        const {
            db,
            delete: deleteFn,
            where,
            returning,
        } = makeDeleteDb([{ id: 'user-1' }]);
        const repository = new DrizzleUserRepository(db);

        const result = await repository.deleteUser('user-1');

        expect(deleteFn).toHaveBeenCalledWith(users);
        expect(where).toHaveBeenCalledWith(expect.any(Object));
        expect(returning).toHaveBeenCalledWith({ id: users.id });
        expect(result).toBe(true);
    });

    it('returns false when no user is deleted', async () => {
        const { db } = makeDeleteDb([]);
        const repository = new DrizzleUserRepository(db);

        const result = await repository.deleteUser('missing-user');

        expect(result).toBe(false);
    });

    it('returns an email-auth user with password hash', async () => {
        const emailAuthRecord = {
            ...userRecord,
            passwordHash: 'hashed-password',
        };
        const { db, select, from, where, limit } = makeSelectDb([
            emailAuthRecord,
        ]);
        const repository = new DrizzleUserRepository(db);

        const result =
            await repository.findEmailAuthUserByEmail('user@example.com');

        expect(select).toHaveBeenCalledWith(expect.any(Object));
        expect(from).toHaveBeenCalledWith(expect.any(Object));
        expect(where).toHaveBeenCalledWith(expect.any(Object));
        expect(limit).toHaveBeenCalledWith(1);
        expect(result).toEqual(emailAuthRecord);
    });

    it('returns null when no email-auth user is found', async () => {
        const { db } = makeSelectDb([]);
        const repository = new DrizzleUserRepository(db);

        const result = await repository.findEmailAuthUserByEmail(
            'missing@example.com'
        );

        expect(result).toBeNull();
    });

    it('inserts a free-tier email user with password hash', async () => {
        const { db, insert, values, onConflictDoNothing, returning } =
            makeInsertDb([userRecord]);
        const repository = new DrizzleUserRepository(db);

        const result = await repository.createEmailUser({
            email: 'user@example.com',
            passwordHash: 'hashed-password',
            name: 'Ada',
        });

        expect(insert).toHaveBeenCalledWith(users);
        expect(values).toHaveBeenCalledWith({
            email: 'user@example.com',
            passwordHash: 'hashed-password',
            name: 'Ada',
            avatarUrl: null,
            tier: 'free',
            emailVerified: false,
        });
        expect(onConflictDoNothing).toHaveBeenCalledWith({
            target: users.email,
        });
        expect(returning).toHaveBeenCalledWith({
            id: users.id,
            email: users.email,
            name: users.name,
            avatarUrl: users.avatarUrl,
            tier: users.tier,
            emailVerified: users.emailVerified,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
        });
        expect(result).toEqual(userRecord);
    });

    it('inserts a user with avatarUrl provided', async () => {
        const recordWithAvatar = {
            ...userRecord,
            avatarUrl: 'https://example.com/avatar.png',
        };
        const { db, values } = makeInsertDb([recordWithAvatar]);
        const repository = new DrizzleUserRepository(db);

        const result = await repository.createEmailUser({
            email: 'user@example.com',
            passwordHash: 'hashed-password',
            avatarUrl: 'https://example.com/avatar.png',
        });

        expect(values).toHaveBeenCalledWith(
            expect.objectContaining({
                avatarUrl: 'https://example.com/avatar.png',
            })
        );
        expect(result).toEqual(recordWithAvatar);
    });

    it('returns null when email insert conflicts', async () => {
        const { db } = makeInsertDb([]);
        const repository = new DrizzleUserRepository(db);

        const result = await repository.createEmailUser({
            email: 'user@example.com',
            passwordHash: 'hashed-password',
        });

        expect(result).toBeNull();
    });

    it('returns a user found by OAuth provider account', async () => {
        const { db, select, from, innerJoin, where, limit } = makeSelectDb([
            userRecord,
        ]);
        const repository = new DrizzleUserRepository(db);

        const result = await repository.findByOAuthAccount(
            'google',
            'provider-user-1'
        );

        expect(select).toHaveBeenCalledWith(expect.any(Object));
        expect(from).toHaveBeenCalledWith(expect.any(Object));
        expect(innerJoin).toHaveBeenCalledWith(
            expect.any(Object),
            expect.any(Object)
        );
        expect(where).toHaveBeenCalledWith(expect.any(Object));
        expect(limit).toHaveBeenCalledWith(1);
        expect(result).toEqual(userRecord);
    });

    it('returns null when no OAuth provider account is found', async () => {
        const { db } = makeSelectDb([]);
        const repository = new DrizzleUserRepository(db);

        const result = await repository.findByOAuthAccount(
            'google',
            'missing-provider-user'
        );

        expect(result).toBeNull();
    });

    it('creates a free-tier OAuth user and provider account link', async () => {
        const { db, userValues, accountValues, accountOnConflictDoNothing } =
            makeOAuthInsertDb({
                userRows: [userRecord],
                accountRows: [{ id: 'oauth-account-1' }],
            });
        const repository = new DrizzleUserRepository(db);

        const result = await repository.createOAuthUser({
            email: 'user@example.com',
            provider: 'google',
            providerAccountId: 'provider-user-1',
            name: 'Ada',
        });

        expect(userValues).toHaveBeenCalledWith({
            email: 'user@example.com',
            passwordHash: null,
            name: 'Ada',
            avatarUrl: null,
            tier: 'free',
            emailVerified: true,
        });
        expect(accountValues).toHaveBeenCalledWith({
            userId: 'user-1',
            provider: 'google',
            providerAccountId: 'provider-user-1',
            accessToken: null,
            refreshToken: null,
            tokenExpiresAt: null,
        });
        expect(accountOnConflictDoNothing).toHaveBeenCalledWith({
            target: [oauthAccounts.provider, oauthAccounts.providerAccountId],
        });
        expect(result).toEqual(userRecord);
    });

    it('creates an OAuth user with avatarUrl provided', async () => {
        const { db, userValues } = makeOAuthInsertDb({
            userRows: [userRecord],
            accountRows: [{ id: 'oauth-account-1' }],
        });
        const repository = new DrizzleUserRepository(db);

        const result = await repository.createOAuthUser({
            email: 'user@example.com',
            provider: 'kakao',
            providerAccountId: 'provider-user-1',
            avatarUrl: 'https://example.com/avatar.png',
        });

        expect(userValues).toHaveBeenCalledWith(
            expect.objectContaining({
                avatarUrl: 'https://example.com/avatar.png',
            })
        );
        expect(result).toEqual(userRecord);
    });

    describe('token encryption in createOAuthUser', () => {
        beforeEach(() => {
            process.env['OAUTH_TOKEN_ENCRYPTION_KEY'] = String(VALID_KEY_HEX);
        });

        afterEach(() => {
            delete process.env['OAUTH_TOKEN_ENCRYPTION_KEY'];
        });

        it('encrypts access and refresh tokens before storage', async () => {
            const { db, accountValues } = makeOAuthInsertDb({
                userRows: [userRecord],
                accountRows: [{ id: 'oauth-account-1' }],
            });
            const repository = new DrizzleUserRepository(db);
            const tokenExpiresAt = new Date('2026-06-01T00:00:00.000Z');

            await repository.createOAuthUser({
                email: 'user@example.com',
                provider: 'google',
                providerAccountId: 'provider-user-1',
                accessToken: 'plain-access-token',
                refreshToken: 'plain-refresh-token',
                tokenExpiresAt,
            });

            const callArg = accountValues.mock.calls[0][0] as {
                accessToken: string | null;
                refreshToken: string | null;
                tokenExpiresAt: Date | null;
            };

            expect(callArg.accessToken).not.toBeNull();
            expect(callArg.accessToken).not.toBe('plain-access-token');
            expect(callArg.refreshToken).not.toBeNull();
            expect(callArg.refreshToken).not.toBe('plain-refresh-token');
            expect(callArg.tokenExpiresAt).toEqual(tokenExpiresAt);

            expect(decryptToken(callArg.accessToken!, VALID_KEY_HEX)).toBe(
                'plain-access-token'
            );
            expect(decryptToken(callArg.refreshToken!, VALID_KEY_HEX)).toBe(
                'plain-refresh-token'
            );
        });

        it('throws and does not write to DB when the encryption key is absent', async () => {
            delete process.env['OAUTH_TOKEN_ENCRYPTION_KEY'];
            const { db, insert } = makeOAuthInsertDb({
                userRows: [userRecord],
                accountRows: [{ id: 'oauth-account-1' }],
            });
            const repository = new DrizzleUserRepository(db);

            await expect(
                repository.createOAuthUser({
                    email: 'user@example.com',
                    provider: 'google',
                    providerAccountId: 'provider-user-1',
                    accessToken: 'plain-access-token',
                    refreshToken: 'plain-refresh-token',
                })
            ).rejects.toThrow(/OAUTH_TOKEN_ENCRYPTION_KEY/);

            // No DB writes must happen when the encryption key is missing.
            expect(insert).not.toHaveBeenCalled();
        });

        it('throws when the encryption key is present but malformed (wrong length)', async () => {
            process.env['OAUTH_TOKEN_ENCRYPTION_KEY'] = 'deadbeef';
            const { db, insert } = makeOAuthInsertDb({
                userRows: [userRecord],
                accountRows: [{ id: 'oauth-account-1' }],
            });
            const repository = new DrizzleUserRepository(db);

            await expect(
                repository.createOAuthUser({
                    email: 'user@example.com',
                    provider: 'google',
                    providerAccountId: 'provider-user-1',
                })
            ).rejects.toThrow(/OAUTH_TOKEN_ENCRYPTION_KEY/);

            expect(insert).not.toHaveBeenCalled();
        });
    });

    it('returns null when OAuth user creation conflicts on email', async () => {
        const { db, insert } = makeOAuthInsertDb({
            userRows: [],
            accountRows: [],
        });
        const repository = new DrizzleUserRepository(db);

        const result = await repository.createOAuthUser({
            email: 'user@example.com',
            provider: 'google',
            providerAccountId: 'provider-user-1',
        });

        expect(insert).toHaveBeenCalledTimes(1);
        expect(result).toBeNull();
    });

    it('returns null and compensates by deleting the user when oauth account link conflicts', async () => {
        const { db, insert, deleteFn, deleteWhere } = makeOAuthInsertDb({
            userRows: [userRecord],
            accountRows: [],
            deleteRows: [{ id: 'user-1' }],
        });
        const repository = new DrizzleUserRepository(db);

        const result = await repository.createOAuthUser({
            email: 'user@example.com',
            provider: 'apple',
            providerAccountId: 'provider-user-1',
        });

        expect(insert).toHaveBeenCalledTimes(2);
        expect(deleteFn).toHaveBeenCalledWith(users);
        expect(deleteWhere).toHaveBeenCalledWith(expect.any(Object));
        expect(result).toBeNull();
    });

    it('rethrows unexpected OAuth user creation failures', async () => {
        const error = new Error('database unavailable');
        const { db } = makeFailingOAuthInsertDb(error);
        const repository = new DrizzleUserRepository(db);

        await expect(
            repository.createOAuthUser({
                email: 'user@example.com',
                provider: 'google',
                providerAccountId: 'provider-user-1',
            })
        ).rejects.toThrow(error);
    });

    it('returns the tier found by user id', async () => {
        const { db, select, from, where, limit } = makeSelectDb([
            { tier: 'member' },
        ]);
        const repository = new DrizzleUserRepository(db);

        const result = await repository.getUserTier('user-1');

        expect(select).toHaveBeenCalledWith({ tier: expect.any(Object) });
        expect(from).toHaveBeenCalledWith(expect.any(Object));
        expect(where).toHaveBeenCalledWith(expect.any(Object));
        expect(limit).toHaveBeenCalledWith(1);
        expect(result).toBe('member');
    });

    it('returns null when no user tier is found', async () => {
        const { db } = makeSelectDb([]);
        const repository = new DrizzleUserRepository(db);

        const result = await repository.getUserTier('missing-user');

        expect(result).toBeNull();
    });

    it('updates a user tier and returns the persisted tier', async () => {
        const { db, update, set, where, returning } = makeUpdateDb([
            { tier: 'pro' },
        ]);
        const repository = new DrizzleUserRepository(db);

        const result = await repository.updateUserTier('user-1', 'pro');

        expect(update).toHaveBeenCalledWith(expect.any(Object));
        expect(set).toHaveBeenCalledWith(
            expect.objectContaining({
                tier: 'pro',
                updatedAt: expect.anything(),
            })
        );
        expect(where).toHaveBeenCalledWith(expect.any(Object));
        expect(returning).toHaveBeenCalledWith({ tier: expect.any(Object) });
        expect(result).toBe('pro');
    });

    it('updateUserTier 는 updatedAt 을 명시적으로 set 한다 (timestamp advances on update)', async () => {
        const { db, set } = makeUpdateDb([{ tier: 'pro' }]);
        const repository = new DrizzleUserRepository(db);
        await repository.updateUserTier('user-1', 'pro');
        const passedSet = set.mock.calls[0][0] as Record<string, unknown>;
        expect(passedSet).toHaveProperty('updatedAt');
        expect(passedSet.updatedAt).toBeDefined();
    });

    it('returns null when no user tier is updated', async () => {
        const { db } = makeUpdateDb([]);
        const repository = new DrizzleUserRepository(db);

        const result = await repository.updateUserTier(
            'missing-user',
            'member'
        );

        expect(result).toBeNull();
    });

    it('updates the password hash and returns true when a row matches', async () => {
        const { db, update, set, where } = makeUpdateDb([{ id: 'user-1' }]);
        const repository = new DrizzleUserRepository(db);

        const result = await repository.updatePassword(
            'user-1',
            'new-password-hash'
        );

        expect(update).toHaveBeenCalledWith(users);
        expect(set).toHaveBeenCalledWith(
            expect.objectContaining({
                passwordHash: 'new-password-hash',
                updatedAt: expect.anything(),
            })
        );
        expect(where).toHaveBeenCalledWith(expect.any(Object));
        expect(result).toBe(true);
    });

    it('returns false when updatePassword finds no matching user', async () => {
        const { db } = makeUpdateDb([]);
        const repository = new DrizzleUserRepository(db);

        const result = await repository.updatePassword(
            'missing-user',
            'new-password-hash'
        );

        expect(result).toBe(false);
    });
});
