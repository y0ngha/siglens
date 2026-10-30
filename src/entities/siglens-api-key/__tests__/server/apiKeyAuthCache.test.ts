const { mockGetRedis } = vi.hoisted(() => ({ mockGetRedis: vi.fn() }));
vi.mock('@/shared/cache/redisClient', () => ({ getRedisClient: mockGetRedis }));

import { revokeApiKeyAuth } from '@/entities/siglens-api-key/server/apiKeyAuthCache';
import {
    API_KEY_AUTH_CACHE_TTL_SECONDS,
    API_KEY_REVOKED_TOMBSTONE_TTL_SECONDS,
} from '@/shared/config/publicApi';

const KEY_HASH = 'b'.repeat(64);

function makeRedis(overrides: Record<string, unknown> = {}) {
    return {
        mget: vi.fn().mockResolvedValue([null, null]),
        exists: vi.fn().mockResolvedValue(0),
        set: vi.fn().mockResolvedValue('OK'),
        del: vi.fn().mockResolvedValue(1),
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('revokeApiKeyAuth', () => {
    it('묘비를 TTL과 함께 쓰고 그다음 캐시 항목을 지운다', async () => {
        const order: string[] = [];
        const redis = makeRedis({
            set: vi.fn(async (key: string) => {
                order.push(`set:${key}`);
                return 'OK';
            }),
            del: vi.fn(async (...keys: string[]) => {
                order.push(`del:${keys.join(',')}`);
                return 1;
            }),
        });
        mockGetRedis.mockReturnValue(redis);
        await expect(revokeApiKeyAuth([KEY_HASH])).resolves.toBe(true);
        expect(redis.set).toHaveBeenCalledWith(
            `siglens-api:revoked:${KEY_HASH}`,
            1,
            { ex: API_KEY_REVOKED_TOMBSTONE_TTL_SECONDS }
        );
        expect(order).toEqual([
            `set:siglens-api:revoked:${KEY_HASH}`,
            `del:siglens-api:key:${KEY_HASH}`,
        ]);
    });

    it('묘비 TTL은 인증 캐시 TTL보다 길다', () => {
        expect(API_KEY_REVOKED_TOMBSTONE_TTL_SECONDS).toBeGreaterThan(
            API_KEY_AUTH_CACHE_TTL_SECONDS
        );
    });

    it('여러 해시를 한 번에 처리한다(계정 삭제)', async () => {
        const redis = makeRedis();
        mockGetRedis.mockReturnValue(redis);
        const other = 'c'.repeat(64);
        await revokeApiKeyAuth([KEY_HASH, other]);
        expect(redis.set).toHaveBeenCalledTimes(2);
        expect(redis.del).toHaveBeenCalledWith(
            `siglens-api:key:${KEY_HASH}`,
            `siglens-api:key:${other}`
        );
    });

    it('해시가 없으면 Redis를 건드리지 않는다', async () => {
        const redis = makeRedis();
        mockGetRedis.mockReturnValue(redis);
        await expect(revokeApiKeyAuth([])).resolves.toBe(true);
        expect(redis.set).not.toHaveBeenCalled();
    });

    it('실패하면 false(폐기 지연 가능)를 돌려준다', async () => {
        mockGetRedis.mockReturnValue(
            makeRedis({ set: vi.fn().mockRejectedValue(new Error('timeout')) })
        );
        await expect(revokeApiKeyAuth([KEY_HASH])).resolves.toBe(false);
    });

    it('Redis가 없으면 지울 캐시도 없으므로 true', async () => {
        mockGetRedis.mockReturnValue(null);
        await expect(revokeApiKeyAuth([KEY_HASH])).resolves.toBe(true);
    });
});
