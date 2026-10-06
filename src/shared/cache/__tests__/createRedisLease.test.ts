vi.mock('server-only', () => ({}));

const { mockSet, mockEval, mockRedis } = vi.hoisted(() => {
    const mockSet = vi.fn();
    const mockEval = vi.fn();
    const mockRedis: Pick<import('@upstash/redis').Redis, 'set' | 'eval'> = {
        set: mockSet,
        eval: mockEval,
    };
    return { mockSet, mockEval, mockRedis };
});

vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: vi.fn(() => mockRedis),
}));

import { getRedisClient } from '@/shared/cache/redisClient';
import { createRedisLease } from '../createRedisLease';

describe('createRedisLease', () => {
    const lease = createRedisLease(
        (id: string) => `test:lease:${id}`,
        60,
        '[testLease]'
    );

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getRedisClient).mockReturnValue(
            mockRedis as unknown as import('@upstash/redis').Redis
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('획득마다 무작위 토큰을 값으로 SET NX EX 한다', async () => {
        mockSet.mockResolvedValue('OK');
        const a = await lease.tryAcquire('x');
        const b = await lease.tryAcquire('x');
        expect(a.status).toBe('acquired');
        expect(b.status).toBe('acquired');
        const [first, second] = mockSet.mock.calls;
        expect(first[0]).toBe('test:lease:x');
        expect(first[2]).toEqual({ nx: true, ex: 60 });
        expect(first[1]).not.toBe('1');
        expect(first[1]).not.toBe(second[1]);
    });

    it('release는 자기 토큰으로 compare-and-delete 한다', async () => {
        mockSet.mockResolvedValue('OK');
        mockEval.mockResolvedValue(1);
        const result = await lease.tryAcquire('x');
        if (result.status !== 'acquired') throw new Error('expected acquired');
        await result.release();
        const token = mockSet.mock.calls[0][1];
        expect(mockEval).toHaveBeenCalledWith(
            expect.stringContaining("redis.call('get', KEYS[1]) == ARGV[1]"),
            ['test:lease:x'],
            [token]
        );
    });

    it('이미 잡혀 있으면 held — 풀 수단이 없다', async () => {
        mockSet.mockResolvedValue(null);
        expect(await lease.tryAcquire('x')).toEqual({ status: 'held' });
    });

    it('Redis 미설정이면 unavailable (fail-open, 풀 것 없음)', async () => {
        vi.mocked(getRedisClient).mockReturnValue(null);
        expect(await lease.tryAcquire('x')).toEqual({ status: 'unavailable' });
        expect(mockSet).not.toHaveBeenCalled();
    });

    it('SET 오류는 unavailable', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mockSet.mockRejectedValue(new Error('down'));
        expect(await lease.tryAcquire('x')).toEqual({ status: 'unavailable' });
    });

    it('release 오류는 삼킨다', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mockSet.mockResolvedValue('OK');
        mockEval.mockRejectedValue(new Error('down'));
        const result = await lease.tryAcquire('x');
        if (result.status !== 'acquired') throw new Error('expected acquired');
        await expect(result.release()).resolves.toBeUndefined();
    });
});
