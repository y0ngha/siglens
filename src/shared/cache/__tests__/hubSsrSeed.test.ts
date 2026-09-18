vi.mock('server-only', () => ({}));

const { mockGet, mockSet, mockRedis } = vi.hoisted(() => {
    const mockGet = vi.fn();
    const mockSet = vi.fn();
    const mockRedis: Pick<import('@upstash/redis').Redis, 'get' | 'set'> = {
        get: mockGet,
        set: mockSet,
    };
    return { mockGet, mockSet, mockRedis };
});

vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: vi.fn(() => mockRedis),
}));

import { getRedisClient } from '@/shared/cache/redisClient';
import { readHubSsrSeed, writeHubSsrSeed } from '../hubSsrSeed';

type RedisLike = import('@upstash/redis').Redis;

describe('hubSsrSeed', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getRedisClient).mockReturnValue(
            mockRedis as unknown as RedisLike
        );
    });

    it('표면 이름을 고정 접두로 키에 붙인다 — 프리웜과 페이지가 같은 키를 봐야 한다', async () => {
        mockGet.mockResolvedValue({ briefing: 'x' });

        await readHubSsrSeed('market-briefing:us');
        await writeHubSsrSeed('macro-briefing', { briefing: 'y' });

        expect(mockGet).toHaveBeenCalledWith('hub-ssr-seed:market-briefing:us');
        expect(mockSet.mock.calls[0]?.[0]).toBe('hub-ssr-seed:macro-briefing');
    });

    /**
     * TTL이 유일한 신선도 방어선이다 — seed로 그려진 브리핑은 생성 시각을 표시하지
     * 않는다(`hubSsrSeed.ts` 상수 주석). 12h는 크론 창 사이 최대 공백(≈10시간 35분)
     * 바로 위 값이다.
     */
    it('TTL 12시간으로 쓴다', async () => {
        await writeHubSsrSeed('macro-briefing', { briefing: 'y' });

        expect(mockSet).toHaveBeenCalledWith(
            expect.any(String),
            { briefing: 'y' },
            { ex: 12 * 60 * 60 }
        );
    });

    it('Redis가 없으면 읽기는 null, 쓰기는 조용히 넘어간다', async () => {
        vi.mocked(getRedisClient).mockReturnValue(null);

        await expect(readHubSsrSeed('macro-briefing')).resolves.toBeNull();
        await expect(
            writeHubSsrSeed('macro-briefing', { briefing: 'y' })
        ).resolves.toBeUndefined();
        expect(mockSet).not.toHaveBeenCalled();
    });

    /**
     * seed는 부가 저장이다. Redis 장애가 프리웜의 본업(생성·무효화)이나 페이지 렌더를
     * 막으면 안 된다.
     */
    it('Redis가 던져도 읽기는 null, 쓰기는 삼킨다', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        mockGet.mockRejectedValue(new Error('upstash down'));
        mockSet.mockRejectedValue(new Error('upstash down'));

        await expect(readHubSsrSeed('macro-briefing')).resolves.toBeNull();
        await expect(
            writeHubSsrSeed('macro-briefing', { briefing: 'y' })
        ).resolves.toBeUndefined();
        expect(errorSpy).toHaveBeenCalledTimes(2);
        errorSpy.mockRestore();
    });

    it('키가 비어 있으면 null을 준다 — undefined를 그대로 흘리지 않는다', async () => {
        mockGet.mockResolvedValue(undefined);

        await expect(readHubSsrSeed('market-briefing:kr')).resolves.toBeNull();
    });
});
