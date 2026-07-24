vi.mock('server-only', () => ({}));

const { mockGet, mockSet, mockDel, mockIncrby, mockExpire, mockRedis } =
    vi.hoisted(() => {
        const mockGet = vi.fn();
        const mockSet = vi.fn();
        const mockDel = vi.fn();
        const mockIncrby = vi.fn();
        const mockExpire = vi.fn();
        const mockRedis: Pick<
            import('@upstash/redis').Redis,
            'get' | 'set' | 'del' | 'incrby' | 'expire'
        > = {
            get: mockGet,
            set: mockSet,
            del: mockDel,
            incrby: mockIncrby,
            expire: mockExpire,
        };
        return { mockGet, mockSet, mockDel, mockIncrby, mockExpire, mockRedis };
    });

vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: vi.fn(() => mockRedis),
}));

import { getRedisClient } from '@/shared/cache/redisClient';
import {
    acquirePrewarmLock,
    releasePrewarmLock,
    markInFlight,
    isInFlight,
    addFmpBudget,
    getFmpBudgetUsed,
} from '../lock';

describe('seo-prewarm lock', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getRedisClient).mockReturnValue(
            mockRedis as unknown as import('@upstash/redis').Redis
        );
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-25T00:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('acquirePrewarmLock', () => {
        it('SET NX EX(900)을 올바른 키로 호출한다', async () => {
            mockSet.mockResolvedValue('OK');
            await acquirePrewarmLock();
            expect(mockSet).toHaveBeenCalledWith(
                'seo-prewarm:lock',
                String(Date.now()),
                { nx: true, ex: 900 }
            );
        });

        it("'OK' 응답 시 true 반환", async () => {
            mockSet.mockResolvedValue('OK');
            expect(await acquirePrewarmLock()).toBe(true);
        });

        it('null 응답 시(락 이미 존재) false 반환', async () => {
            mockSet.mockResolvedValue(null);
            expect(await acquirePrewarmLock()).toBe(false);
        });

        it('redis null이면 false 반환, throw 없음', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);
            const errSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            await expect(acquirePrewarmLock()).resolves.toBe(false);
            expect(mockSet).not.toHaveBeenCalled();
            expect(errSpy).toHaveBeenCalled();
            errSpy.mockRestore();
        });
    });

    describe('releasePrewarmLock', () => {
        it('DEL을 올바른 키로 호출한다', async () => {
            await releasePrewarmLock();
            expect(mockDel).toHaveBeenCalledWith('seo-prewarm:lock');
        });

        it('redis null이면 noop, throw 없음', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);
            await expect(releasePrewarmLock()).resolves.toBeUndefined();
            expect(mockDel).not.toHaveBeenCalled();
        });
    });

    describe('markInFlight', () => {
        it('ex:1800과 대문자화된 심볼 키로 SET을 호출한다', async () => {
            await markInFlight('aapl', 'overall');
            expect(mockSet).toHaveBeenCalledWith(
                'seo-prewarm:inflight:AAPL:overall',
                '1',
                { ex: 1800 }
            );
        });

        it('redis null이면 noop, throw 없음', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);
            await expect(
                markInFlight('aapl', 'overall')
            ).resolves.toBeUndefined();
            expect(mockSet).not.toHaveBeenCalled();
        });
    });

    describe('isInFlight', () => {
        it('get이 non-null을 반환하면 true', async () => {
            mockGet.mockResolvedValue('1');
            expect(await isInFlight('aapl', 'overall')).toBe(true);
            expect(mockGet).toHaveBeenCalledWith(
                'seo-prewarm:inflight:AAPL:overall'
            );
        });

        it('get이 null을 반환하면 false', async () => {
            mockGet.mockResolvedValue(null);
            expect(await isInFlight('aapl', 'overall')).toBe(false);
        });

        it('redis null이면 false 반환, throw 없음', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);
            await expect(isInFlight('aapl', 'overall')).resolves.toBe(false);
            expect(mockGet).not.toHaveBeenCalled();
        });
    });

    describe('addFmpBudget', () => {
        it('incrby(dateKey, n) 호출 후 expire, incrby 결과를 반환한다', async () => {
            mockIncrby.mockResolvedValue(42);
            const result = await addFmpBudget(5);
            expect(mockIncrby).toHaveBeenCalledWith(
                'seo-prewarm:fmp-budget:2026-07-25',
                5
            );
            expect(mockExpire).toHaveBeenCalledWith(
                'seo-prewarm:fmp-budget:2026-07-25',
                172800
            );
            expect(result).toBe(42);
        });

        it('redis null이면 0 반환, throw 없음', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);
            expect(await addFmpBudget(5)).toBe(0);
            expect(mockIncrby).not.toHaveBeenCalled();
        });
    });

    describe('getFmpBudgetUsed', () => {
        it('get이 number를 반환하면 그대로 반환한다', async () => {
            mockGet.mockResolvedValue(42);
            expect(await getFmpBudgetUsed()).toBe(42);
            expect(mockGet).toHaveBeenCalledWith(
                'seo-prewarm:fmp-budget:2026-07-25'
            );
        });

        it('get이 string을 반환하면 숫자로 변환한다', async () => {
            mockGet.mockResolvedValue('42');
            expect(await getFmpBudgetUsed()).toBe(42);
        });

        it('get이 null을 반환하면 0을 반환한다', async () => {
            mockGet.mockResolvedValue(null);
            expect(await getFmpBudgetUsed()).toBe(0);
        });

        it('redis null이면 0 반환, throw 없음', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);
            expect(await getFmpBudgetUsed()).toBe(0);
            expect(mockGet).not.toHaveBeenCalled();
        });
    });
});
