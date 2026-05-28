import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { getRedisClient } from '@/shared/cache/redisClient';

vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: vi.fn(),
}));

const mockedGetRedisClient = vi.mocked(getRedisClient);

function createRedisStub() {
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

    it('캐시 히트 시 fetcher를 호출하지 않고 저장된 값을 반환한다', async () => {
        const redis = createRedisStub();
        redis.store.set('k', 'cached');
        mockedGetRedisClient.mockReturnValue(redis as never);
        const fetcher = vi.fn().mockResolvedValue('fresh');

        const result = await getOrSetCache('k', 60, fetcher);

        expect(result).toBe('cached');
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('캐시 미스 시 fetcher를 호출하고 TTL과 함께 저장한다', async () => {
        const redis = createRedisStub();
        mockedGetRedisClient.mockReturnValue(redis as never);
        const fetcher = vi.fn().mockResolvedValue('fresh');

        const result = await getOrSetCache('k', 120, fetcher);

        expect(result).toBe('fresh');
        expect(redis.set).toHaveBeenCalledWith('k', 'fresh', { ex: 120 });
    });

    it('빈 배열은 캐시한다(legit empty)', async () => {
        const redis = createRedisStub();
        mockedGetRedisClient.mockReturnValue(redis as never);
        const fetcher = vi.fn().mockResolvedValue([]);

        await getOrSetCache('k', 60, fetcher);

        expect(redis.set).toHaveBeenCalledWith('k', [], { ex: 60 });
    });

    it('shouldCache가 false면 저장하지 않는다(transient null)', async () => {
        const redis = createRedisStub();
        mockedGetRedisClient.mockReturnValue(redis as never);
        const fetcher = vi.fn().mockResolvedValue(null);

        const result = await getOrSetCache(
            'k',
            60,
            fetcher,
            value => value !== null
        );

        expect(result).toBeNull();
        expect(redis.set).not.toHaveBeenCalled();
    });

    it('get 실패 시 fetcher로 graceful fallback한다', async () => {
        const redis = createRedisStub();
        redis.get.mockRejectedValueOnce(new Error('boom'));
        mockedGetRedisClient.mockReturnValue(redis as never);
        const fetcher = vi.fn().mockResolvedValue('fresh');

        const result = await getOrSetCache('k', 60, fetcher);

        expect(result).toBe('fresh');
    });

    it('set 실패해도 fresh 값을 반환한다', async () => {
        const redis = createRedisStub();
        redis.set.mockRejectedValueOnce(new Error('boom'));
        mockedGetRedisClient.mockReturnValue(redis as never);
        const fetcher = vi.fn().mockResolvedValue('fresh');

        const result = await getOrSetCache('k', 60, fetcher);

        expect(result).toBe('fresh');
    });
});
