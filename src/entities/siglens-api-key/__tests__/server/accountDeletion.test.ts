/**
 * 계정 삭제 직후 그 회원의 키는 401이어야 한다. DB 행은 FK cascade로 사라지지만 인증 캐시는
 * 60초 살아 있다 — 이 테스트는 캐시가 **채워진 상태**에서 실제 `deleteAccount`와 실제 인증을
 * 상태 있는 Redis fake 위에서 이어 돌려, 묘비가 캐시 적중을 끊는지 본다. DB fake는 삭제 뒤에도
 * 여전히 principal을 돌려주도록 해 둔다(= 캐시 무효화만이 막는 상황).
 */
const { mockRedis, mockFind, mockTouch, store } = vi.hoisted(() => {
    const store = new Map<string, unknown>();
    return {
        store,
        mockFind: vi.fn(),
        mockTouch: vi.fn(),
        mockRedis: {
            mget: vi.fn(async (...keys: string[]) =>
                keys.map(key => store.get(key) ?? null)
            ),
            exists: vi.fn(async (key: string) => (store.has(key) ? 1 : 0)),
            set: vi.fn(async (key: string, value: unknown) => {
                store.set(key, value);
                return 'OK';
            }),
            del: vi.fn(async (...keys: string[]) => {
                keys.forEach(key => store.delete(key));
                return keys.length;
            }),
        },
    };
});
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: () => mockRedis,
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));
vi.mock('@/entities/siglens-api-key/api', () => ({
    DrizzleSiglensApiKeyRepository: vi.fn().mockImplementation(function () {
        return {
            findActivePrincipalByHash: mockFind,
            touchLastUsed: mockTouch,
        };
    }),
}));

import { deleteAccount } from '@/entities/auth/lib/deleteAccount';
import { hashApiKey } from '@/entities/siglens-api-key/server/apiKeyToken';
import { authenticateApiKey } from '@/entities/siglens-api-key/server/apiKeyAuth';
import { revokeApiKeyAuth } from '@/entities/siglens-api-key/server/apiKeyAuthCache';

const RAW_KEY = `slk_${'d3L'.repeat(13)}x`;
const HEADER = `Bearer ${RAW_KEY}`;
const KEY_HASH = hashApiKey(RAW_KEY);
const principal = {
    keyId: 'key-1',
    keyName: 'n',
    keyPrefix: 'slk_d3Ld3L',
    userId: 'user-1',
    tier: 'member' as const,
};

function makeDeps(deleted = true) {
    return {
        users: {
            findByEmail: vi.fn(),
            findById: vi.fn(),
            createEmailUser: vi.fn(),
            deleteUser: vi.fn().mockResolvedValue(deleted),
            updatePassword: vi.fn(),
        },
        oauthAccounts: { findByUserId: vi.fn().mockResolvedValue([]) },
        oauthRevoker: { revokeToken: vi.fn() },
        apiKeys: {
            listActiveKeyHashes: vi.fn().mockResolvedValue([KEY_HASH]),
            revokeAuth: revokeApiKeyAuth,
        },
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    store.clear();
    mockFind.mockResolvedValue(principal);
    mockTouch.mockResolvedValue(undefined);
});

describe('계정 삭제 -> 키 인증', () => {
    it('삭제 전에는 캐시된 키가 인증된다', async () => {
        await expect(authenticateApiKey(HEADER)).resolves.toMatchObject({
            status: 'ok',
        });
        expect(store.has(`siglens-api:key:${KEY_HASH}`)).toBe(true);
    });

    it('삭제 직후 같은 키는 캐시가 살아 있어도 바로 invalid(401)', async () => {
        await authenticateApiKey(HEADER); // 캐시를 채운다
        mockFind.mockClear();

        await deleteAccount({ userId: 'user-1' }, makeDeps());

        await expect(authenticateApiKey(HEADER)).resolves.toEqual({
            status: 'invalid',
        });
        expect(mockFind).not.toHaveBeenCalled();
    });

    it('삭제가 실패하면(user_not_found) 인증은 그대로 유지된다', async () => {
        await authenticateApiKey(HEADER);
        await deleteAccount({ userId: 'user-1' }, makeDeps(false));
        await expect(authenticateApiKey(HEADER)).resolves.toMatchObject({
            status: 'ok',
        });
    });
});
