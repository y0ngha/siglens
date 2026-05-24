// withRetry 내부 sleep을 즉시 resolve로 stubbing해서 transient retry 케이스의
// 실제 대기 시간을 없앤다. `jest.mock` 은 정적 import 보다 먼저 평가되도록
// 호이스트되어야 한다 (`import/first` 규칙과 일치).
jest.mock('@/shared/lib/sleep', () => ({
    sleep: jest.fn().mockResolvedValue(undefined),
}));

import { encryptToken } from '@/shared/db/tokenEncryption';
import {
    DrizzleUserApiKeyRepository,
    LlmApiKeyDecryptionFailedError,
} from '@/entities/api-key';
import type { SiglensDatabase } from '@/shared/db/types';

const VALID_KEY_HEX = 'b'.repeat(64);
const OTHER_KEY_HEX = 'c'.repeat(64);
const PLAINTEXT_API_KEY = 'sk-ant-test-1234';
const createdAt = new Date('2026-05-01T00:00:00.000Z');
const updatedAt = new Date('2026-05-01T00:00:01.000Z');

const metaRow = {
    id: 'key-1',
    userId: 'user-1',
    provider: 'anthropic' as const,
    createdAt,
    updatedAt,
};

function makeUpsertDb(rows: unknown[]): {
    db: SiglensDatabase;
    insert: ReturnType<typeof jest.fn>;
    values: ReturnType<typeof jest.fn>;
    onConflictDoUpdate: ReturnType<typeof jest.fn>;
    returning: ReturnType<typeof jest.fn>;
} {
    const returning = jest.fn().mockResolvedValue(rows);
    const onConflictDoUpdate = jest.fn(() => ({ returning }));
    const values = jest.fn(() => ({ onConflictDoUpdate }));
    const insert = jest.fn(() => ({ values }));

    return {
        db: { insert } as unknown as SiglensDatabase,
        insert,
        values,
        onConflictDoUpdate,
        returning,
    };
}

function makeFindByUserDb(rows: unknown[]): {
    db: SiglensDatabase;
    where: ReturnType<typeof jest.fn>;
} {
    const where = jest.fn().mockResolvedValue(rows);
    const from = jest.fn(() => ({ where }));
    const select = jest.fn(() => ({ from }));
    return {
        db: { select } as unknown as SiglensDatabase,
        where,
    };
}

function makeFindByUserAndProviderDb(rows: unknown[]): {
    db: SiglensDatabase;
    limit: ReturnType<typeof jest.fn>;
} {
    const limit = jest.fn().mockResolvedValue(rows);
    const where = jest.fn(() => ({ limit }));
    const from = jest.fn(() => ({ where }));
    const select = jest.fn(() => ({ from }));
    return {
        db: { select } as unknown as SiglensDatabase,
        limit,
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

describe('DrizzleUserApiKeyRepository.upsert', () => {
    const UPSERT_INPUT = {
        userId: 'user-1',
        provider: 'anthropic' as const,
        apiKey: PLAINTEXT_API_KEY,
    };

    beforeEach(() => {
        process.env['LLM_API_KEY_ENCRYPTION_KEY'] = String(VALID_KEY_HEX);
    });

    afterEach(() => {
        delete process.env['LLM_API_KEY_ENCRYPTION_KEY'];
    });

    it('throws when the LLM encryption key is missing', async () => {
        process.env['LLM_API_KEY_ENCRYPTION_KEY'] = '';
        const { db } = makeUpsertDb([metaRow]);
        const repo = new DrizzleUserApiKeyRepository(db);

        await expect(repo.upsert(UPSERT_INPUT)).rejects.toThrow(
            'LLM_API_KEY_ENCRYPTION_KEY environment variable is required'
        );
    });

    it('throws when the LLM encryption key has the wrong byte length', async () => {
        process.env['LLM_API_KEY_ENCRYPTION_KEY'] = 'abcd';
        const { db } = makeUpsertDb([metaRow]);
        const repo = new DrizzleUserApiKeyRepository(db);

        await expect(repo.upsert(UPSERT_INPUT)).rejects.toThrow(
            'LLM_API_KEY_ENCRYPTION_KEY environment variable is required'
        );
    });

    it('encrypts the api key, inserts a new row, and returns metadata only', async () => {
        const { db, values, onConflictDoUpdate, returning } = makeUpsertDb([
            metaRow,
        ]);
        const repo = new DrizzleUserApiKeyRepository(db);

        const result = await repo.upsert(UPSERT_INPUT);

        expect(result).toEqual(metaRow);
        // Result must not expose the plaintext or ciphertext field.
        expect(result).not.toHaveProperty('apiKey');
        expect(result).not.toHaveProperty('encryptedApiKey');

        const [insertedValues] = values.mock.calls[0] ?? [];
        expect(insertedValues).toMatchObject({
            userId: 'user-1',
            provider: 'anthropic',
        });
        const encryptedAtInsert = (
            insertedValues as { encryptedApiKey: string }
        ).encryptedApiKey;
        expect(encryptedAtInsert).not.toBe(PLAINTEXT_API_KEY);
        expect(encryptedAtInsert.split(':')).toHaveLength(3);

        // onConflictDoUpdate must use the same ciphertext as the insert path
        // so the update branch never silently writes a stale value.
        const [conflictArgs] = onConflictDoUpdate.mock.calls[0] ?? [];
        const conflictSet = (
            conflictArgs as {
                set: { encryptedApiKey: string; updatedAt: unknown };
            }
        ).set;
        expect(conflictSet.encryptedApiKey).toBe(encryptedAtInsert);
        expect(conflictSet.updatedAt).toBeDefined();
        expect(returning).toHaveBeenCalledTimes(1);
    });

    it('throws when the database returns no row (defensive guard)', async () => {
        const { db } = makeUpsertDb([]);
        const repo = new DrizzleUserApiKeyRepository(db);

        await expect(repo.upsert(UPSERT_INPUT)).rejects.toThrow(
            'Failed to upsert user API key'
        );
    });
});

describe('DrizzleUserApiKeyRepository.findByUser', () => {
    afterEach(() => {
        delete process.env['LLM_API_KEY_ENCRYPTION_KEY'];
    });

    it('returns an empty array when the user has no stored keys', async () => {
        const { db } = makeFindByUserDb([]);
        const repo = new DrizzleUserApiKeyRepository(db);

        const result = await repo.findByUser('user-1');

        expect(result).toEqual([]);
    });

    it('returns metadata records without plaintext fields', async () => {
        const rows = [
            metaRow,
            { ...metaRow, id: 'key-2', provider: 'google' as const },
        ];
        const { db } = makeFindByUserDb(rows);
        const repo = new DrizzleUserApiKeyRepository(db);

        const result = await repo.findByUser('user-1');

        expect(result).toEqual(rows);
        for (const record of result) {
            expect(record).not.toHaveProperty('apiKey');
            expect(record).not.toHaveProperty('encryptedApiKey');
        }
    });

    it('does not require the encryption key to be present', async () => {
        process.env['LLM_API_KEY_ENCRYPTION_KEY'] = '';
        const { db } = makeFindByUserDb([metaRow]);
        const repo = new DrizzleUserApiKeyRepository(db);

        await expect(repo.findByUser('user-1')).resolves.toEqual([metaRow]);
    });
});

describe('DrizzleUserApiKeyRepository.findByUserAndProvider', () => {
    beforeEach(() => {
        process.env['LLM_API_KEY_ENCRYPTION_KEY'] = String(VALID_KEY_HEX);
    });

    afterEach(() => {
        delete process.env['LLM_API_KEY_ENCRYPTION_KEY'];
    });

    it('returns null when no row exists for the user/provider pair', async () => {
        const { db } = makeFindByUserAndProviderDb([]);
        const repo = new DrizzleUserApiKeyRepository(db);

        const result = await repo.findByUserAndProvider('user-1', 'anthropic');

        expect(result).toBeNull();
    });

    it('returns null without throwing when no row exists even if the key is missing', async () => {
        process.env['LLM_API_KEY_ENCRYPTION_KEY'] = '';
        const { db } = makeFindByUserAndProviderDb([]);
        const repo = new DrizzleUserApiKeyRepository(db);

        await expect(
            repo.findByUserAndProvider('user-1', 'anthropic')
        ).resolves.toBeNull();
    });

    it('throws when a row exists but the encryption key is missing', async () => {
        process.env['LLM_API_KEY_ENCRYPTION_KEY'] = '';
        const encrypted = encryptToken(PLAINTEXT_API_KEY, VALID_KEY_HEX);
        const { db } = makeFindByUserAndProviderDb([
            { ...metaRow, encryptedApiKey: encrypted },
        ]);
        const repo = new DrizzleUserApiKeyRepository(db);

        await expect(
            repo.findByUserAndProvider('user-1', 'anthropic')
        ).rejects.toThrow(
            'LLM_API_KEY_ENCRYPTION_KEY environment variable is required'
        );
    });

    it('decrypts the stored ciphertext and returns the plaintext record', async () => {
        const encrypted = encryptToken(PLAINTEXT_API_KEY, VALID_KEY_HEX);
        const { db } = makeFindByUserAndProviderDb([
            { ...metaRow, encryptedApiKey: encrypted },
        ]);
        const repo = new DrizzleUserApiKeyRepository(db);

        const result = await repo.findByUserAndProvider('user-1', 'anthropic');

        expect(result).toEqual({
            ...metaRow,
            apiKey: PLAINTEXT_API_KEY,
        });
    });

    it('throws LlmApiKeyDecryptionFailedError when ciphertext cannot be decrypted with the configured key', async () => {
        const encryptedWithOtherKey = encryptToken(
            PLAINTEXT_API_KEY,
            OTHER_KEY_HEX
        );
        const { db } = makeFindByUserAndProviderDb([
            { ...metaRow, encryptedApiKey: encryptedWithOtherKey },
        ]);
        const repo = new DrizzleUserApiKeyRepository(db);
        const consoleErrorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        await expect(
            repo.findByUserAndProvider('user-1', 'anthropic')
        ).rejects.toBeInstanceOf(LlmApiKeyDecryptionFailedError);

        consoleErrorSpy.mockRestore();
    });

    it('attaches userId/provider context to the decryption error', async () => {
        const encryptedWithOtherKey = encryptToken(
            PLAINTEXT_API_KEY,
            OTHER_KEY_HEX
        );
        const { db } = makeFindByUserAndProviderDb([
            { ...metaRow, encryptedApiKey: encryptedWithOtherKey },
        ]);
        const repo = new DrizzleUserApiKeyRepository(db);
        const consoleErrorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        await expect(
            repo.findByUserAndProvider('user-1', 'anthropic')
        ).rejects.toMatchObject({
            code: 'api_key_corrupted',
            userId: 'user-1',
            provider: 'anthropic',
        });

        consoleErrorSpy.mockRestore();
    });
});

describe('DrizzleUserApiKeyRepository.deleteByUserAndProvider', () => {
    afterEach(() => {
        delete process.env['LLM_API_KEY_ENCRYPTION_KEY'];
    });

    it('returns false when no row was deleted', async () => {
        const { db } = makeDeleteDb([]);
        const repo = new DrizzleUserApiKeyRepository(db);

        const result = await repo.deleteByUserAndProvider(
            'user-1',
            'anthropic'
        );

        expect(result).toBe(false);
    });

    it('returns true when a row was deleted', async () => {
        const { db, returning } = makeDeleteDb([{ id: 'key-1' }]);
        const repo = new DrizzleUserApiKeyRepository(db);

        const result = await repo.deleteByUserAndProvider(
            'user-1',
            'anthropic'
        );

        expect(result).toBe(true);
        expect(returning).toHaveBeenCalledTimes(1);
    });

    it('does not require the encryption key to be present', async () => {
        process.env['LLM_API_KEY_ENCRYPTION_KEY'] = '';
        const { db } = makeDeleteDb([{ id: 'key-1' }]);
        const repo = new DrizzleUserApiKeyRepository(db);

        await expect(
            repo.deleteByUserAndProvider('user-1', 'anthropic')
        ).resolves.toBe(true);
    });
});

// upsert 가 NEON_TRANSIENT_RETRY 정책을 실제로 통과시키는지 확인하는 smoke 테스트.
// withRetry/isNeonTransientError 자체 동작은 각자의 단위 테스트에서 검증하므로
// 여기서는 "정책이 wire-up 됐다"만 보장한다.
describe('DrizzleUserApiKeyRepository.upsert — Neon transient retry wire-up', () => {
    const UPSERT_INPUT = {
        userId: 'user-1',
        provider: 'anthropic' as const,
        apiKey: PLAINTEXT_API_KEY,
    };

    beforeEach(() => {
        process.env['LLM_API_KEY_ENCRYPTION_KEY'] = String(VALID_KEY_HEX);
    });

    afterEach(() => {
        delete process.env['LLM_API_KEY_ENCRYPTION_KEY'];
    });

    it('transient NeonDbError 가 발생하면 재시도해 결국 성공한다', async () => {
        const neonTransient = Object.assign(
            new Error('Error connecting to database: fetch failed'),
            { name: 'NeonDbError' }
        );
        const returning = jest
            .fn()
            .mockRejectedValueOnce(neonTransient)
            .mockResolvedValueOnce([metaRow]);
        const onConflictDoUpdate = jest.fn(() => ({ returning }));
        const values = jest.fn(() => ({ onConflictDoUpdate }));
        const insert = jest.fn(() => ({ values }));
        const db = { insert } as unknown as SiglensDatabase;
        const repo = new DrizzleUserApiKeyRepository(db);

        await expect(repo.upsert(UPSERT_INPUT)).resolves.toEqual(metaRow);
        expect(insert).toHaveBeenCalledTimes(2);
        expect(returning).toHaveBeenCalledTimes(2);
    });

    it('non-transient 에러는 재시도 없이 즉시 전파한다', async () => {
        const constraintError = Object.assign(
            new Error(
                'duplicate key value violates unique constraint "user_api_keys_user_provider_unique"'
            ),
            { name: 'NeonDbError' }
        );
        const returning = jest.fn().mockRejectedValueOnce(constraintError);
        const onConflictDoUpdate = jest.fn(() => ({ returning }));
        const values = jest.fn(() => ({ onConflictDoUpdate }));
        const insert = jest.fn(() => ({ values }));
        const db = { insert } as unknown as SiglensDatabase;
        const repo = new DrizzleUserApiKeyRepository(db);

        await expect(repo.upsert(UPSERT_INPUT)).rejects.toBe(constraintError);
        expect(insert).toHaveBeenCalledTimes(1);
    });
});
