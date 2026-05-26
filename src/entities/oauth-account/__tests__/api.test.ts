import { DrizzleOAuthAccountRepository } from '@/entities/oauth-account/api';
import { encryptToken } from '@/shared/db/tokenEncryption';
import type { SiglensDatabase } from '@/shared/db/types';

const VALID_KEY_HEX = '0'.repeat(64);
const createdAt = new Date('2026-04-27T00:00:00.000Z');

function makeSelectDb(rows: unknown[]): {
    db: SiglensDatabase;
    select: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
} {
    const where = vi.fn().mockResolvedValue(rows);
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    return {
        db: { select } as unknown as SiglensDatabase,
        select,
        from,
        where,
    };
}

describe('DrizzleOAuthAccountRepository.findByUserId', () => {
    beforeEach(() => {
        process.env['OAUTH_TOKEN_ENCRYPTION_KEY'] = String(VALID_KEY_HEX);
    });

    afterEach(() => {
        delete process.env['OAUTH_TOKEN_ENCRYPTION_KEY'];
    });

    it('returns an empty array when no accounts exist for the user', async () => {
        const { db } = makeSelectDb([]);
        const repo = new DrizzleOAuthAccountRepository(db);
        const result = await repo.findByUserId('user-1');
        expect(result).toEqual([]);
    });

    it('decrypts access and refresh tokens from stored rows', async () => {
        const encryptedAccess = encryptToken('access-token-123', VALID_KEY_HEX);
        const encryptedRefresh = encryptToken(
            'refresh-token-456',
            VALID_KEY_HEX
        );
        const tokenExpiresAt = new Date('2026-05-27T00:00:00.000Z');

        const { db } = makeSelectDb([
            {
                id: 'account-1',
                userId: 'user-1',
                provider: 'google',
                providerAccountId: 'google-uid-1',
                accessToken: encryptedAccess,
                refreshToken: encryptedRefresh,
                tokenExpiresAt,
                createdAt,
            },
        ]);

        const repo = new DrizzleOAuthAccountRepository(db);
        const result = await repo.findByUserId('user-1');

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            id: 'account-1',
            userId: 'user-1',
            provider: 'google',
            providerAccountId: 'google-uid-1',
            accessToken: 'access-token-123',
            refreshToken: 'refresh-token-456',
            tokenExpiresAt,
            createdAt,
        });
    });

    it('returns null tokens when the stored values are null', async () => {
        const { db } = makeSelectDb([
            {
                id: 'account-2',
                userId: 'user-1',
                provider: 'kakao',
                providerAccountId: 'kakao-uid-2',
                accessToken: null,
                refreshToken: null,
                tokenExpiresAt: null,
                createdAt,
            },
        ]);

        const repo = new DrizzleOAuthAccountRepository(db);
        const result = await repo.findByUserId('user-1');

        expect(result[0]?.accessToken).toBeNull();
        expect(result[0]?.refreshToken).toBeNull();
        expect(result[0]?.tokenExpiresAt).toBeNull();
    });

    it('returns null tokens when the ciphertext cannot be decrypted with the stored key', async () => {
        const differentKey = 'f'.repeat(64);
        const encryptedWithDifferentKey = encryptToken('secret', differentKey);

        const { db } = makeSelectDb([
            {
                id: 'account-4',
                userId: 'user-1',
                provider: 'google',
                providerAccountId: 'google-uid-4',
                accessToken: encryptedWithDifferentKey,
                refreshToken: null,
                tokenExpiresAt: null,
                createdAt,
            },
        ]);

        const repo = new DrizzleOAuthAccountRepository(db);
        const result = await repo.findByUserId('user-1');

        expect(result[0]?.accessToken).toBeNull();
    });

    it('returns null tokens when the encryption key is missing', async () => {
        process.env['OAUTH_TOKEN_ENCRYPTION_KEY'] = String('');
        const { db } = makeSelectDb([
            {
                id: 'account-3',
                userId: 'user-1',
                provider: 'google',
                providerAccountId: 'google-uid-3',
                accessToken: 'some-encrypted-value:iv:tag',
                refreshToken: null,
                tokenExpiresAt: null,
                createdAt,
            },
        ]);

        const repo = new DrizzleOAuthAccountRepository(db);
        const result = await repo.findByUserId('user-1');

        expect(result[0]?.accessToken).toBeNull();
        expect(result[0]?.refreshToken).toBeNull();
    });
});
