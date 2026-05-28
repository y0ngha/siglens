vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: vi.fn(),
}));

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { getRedisClient } from '@/shared/cache/redisClient';

const mockedGetRedisClient = vi.mocked(getRedisClient);

interface RedisStub {
    store: Map<string, unknown>;
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
}

function createRedisStub(): RedisStub {
    const store = new Map<string, unknown>();
    return {
        store,
        get: vi.fn((key: string) => (store.has(key) ? store.get(key) : null)),
        set: vi.fn((key: string, value: unknown) => {
            store.set(key, value);
            return 'OK';
        }),
    };
}

describe('getOrSetCache 함수는', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('Redis 미설정 시 fetcher 결과를 반환한다', async () => {
        mockedGetRedisClient.mockReturnValue(null);
        const fetcher = vi.fn().mockResolvedValue('fresh');

        const result = await getOrSetCache('k', 60, fetcher);

        expect(result).toBe('fresh');
        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('캐시 히트 시 fetcher를 호출하지 않고 envelope 안의 값을 반환한다', async () => {
        const redis = createRedisStub();
        redis.store.set('k', { data: 'cached' });
        mockedGetRedisClient.mockReturnValue(redis as never);
        const fetcher = vi.fn().mockResolvedValue('fresh');

        const result = await getOrSetCache('k', 60, fetcher);

        expect(result).toBe('cached');
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('캐시 미스 시 fetcher를 호출하고 envelope으로 감싸 TTL과 함께 저장한다', async () => {
        const redis = createRedisStub();
        mockedGetRedisClient.mockReturnValue(redis as never);
        const fetcher = vi.fn().mockResolvedValue('fresh');

        const result = await getOrSetCache('k', 120, fetcher);

        expect(result).toBe('fresh');
        expect(redis.set).toHaveBeenCalledWith(
            'k',
            { data: 'fresh' },
            { ex: 120 }
        );
    });

    it('빈 배열도 envelope으로 캐싱한다(legit empty)', async () => {
        const redis = createRedisStub();
        mockedGetRedisClient.mockReturnValue(redis as never);
        const fetcher = vi.fn().mockResolvedValue([]);

        await getOrSetCache('k', 60, fetcher);

        expect(redis.set).toHaveBeenCalledWith('k', { data: [] }, { ex: 60 });
    });

    it('null 결과도 envelope으로 캐싱한다(데이터 없음 = stable)', async () => {
        const redis = createRedisStub();
        mockedGetRedisClient.mockReturnValue(redis as never);
        const fetcher = vi.fn().mockResolvedValue(null);

        const result = await getOrSetCache('k', 60, fetcher);

        expect(result).toBeNull();
        expect(redis.set).toHaveBeenCalledWith('k', { data: null }, { ex: 60 });
    });

    it('저장된 null envelope은 캐시 히트로 처리해 fetcher를 호출하지 않는다', async () => {
        const redis = createRedisStub();
        redis.store.set('k', { data: null });
        mockedGetRedisClient.mockReturnValue(redis as never);
        const fetcher = vi.fn().mockResolvedValue('fresh');

        const result = await getOrSetCache('k', 60, fetcher);

        expect(result).toBeNull();
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('get 실패 시 fetcher로 graceful fallback하고 에러를 로깅한다', async () => {
        const redis = createRedisStub();
        redis.get.mockRejectedValueOnce(new Error('boom'));
        mockedGetRedisClient.mockReturnValue(redis as never);
        const fetcher = vi.fn().mockResolvedValue('fresh');

        const result = await getOrSetCache('k', 60, fetcher);

        expect(result).toBe('fresh');
        expect(console.error).toHaveBeenCalledWith(
            '[getOrSetCache] get failed: k',
            expect.any(Error)
        );
    });

    it('set 실패해도 fresh 값을 반환하고 에러를 로깅한다', async () => {
        const redis = createRedisStub();
        redis.set.mockRejectedValueOnce(new Error('boom'));
        mockedGetRedisClient.mockReturnValue(redis as never);
        const fetcher = vi.fn().mockResolvedValue('fresh');

        const result = await getOrSetCache('k', 60, fetcher);

        expect(result).toBe('fresh');
        expect(console.error).toHaveBeenCalledWith(
            '[getOrSetCache] set failed: k',
            expect.any(Error)
        );
    });
});
