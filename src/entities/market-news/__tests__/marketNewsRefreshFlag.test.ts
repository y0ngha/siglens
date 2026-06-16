vi.mock('server-only', () => ({}));

const { mockGet, mockSet, mockRedis } = vi.hoisted(() => {
    const mockGet = vi.fn();
    const mockSet = vi.fn();
    // Partial mock — only the methods used by marketNewsRefreshFlag.
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
import {
    isRecentlyFetched,
    markFetched,
    MARKET_NEWS_REFRESH_FLAG_TTL_SECONDS,
} from '../lib/marketNewsRefreshFlag';
import { CATEGORY_CONFIG } from '../lib/categoryConfig';

const cryptoSentinel = CATEGORY_CONFIG['crypto'].sentinel; // '__NEWS_CRYPTO__'

describe('marketNewsRefreshFlag', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getRedisClient).mockReturnValue(
            mockRedis as unknown as import('@upstash/redis').Redis
        );
    });

    describe('isRecentlyFetched', () => {
        it('Redis가 null이면 false를 반환하고 get을 호출하지 않는다', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);
            expect(await isRecentlyFetched(cryptoSentinel)).toBe(false);
            expect(mockGet).not.toHaveBeenCalled();
        });

        it('Redis get이 문자열을 반환하면 true를 반환한다(플래그 있음)', async () => {
            mockGet.mockResolvedValue('1');
            expect(await isRecentlyFetched(cryptoSentinel)).toBe(true);
            expect(mockGet).toHaveBeenCalledWith(
                `market-news:refresh:${cryptoSentinel}`
            );
        });

        it('Redis get이 null을 반환하면 false를 반환한다(플래그 없음)', async () => {
            mockGet.mockResolvedValue(null);
            expect(await isRecentlyFetched(cryptoSentinel)).toBe(false);
        });

        it('Redis get이 예외를 던지면 false를 반환한다(graceful degrade)', async () => {
            const errSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            mockGet.mockRejectedValue(new Error('redis down'));
            expect(await isRecentlyFetched(cryptoSentinel)).toBe(false);
            expect(errSpy).toHaveBeenCalled();
            errSpy.mockRestore();
        });
    });

    describe('markFetched', () => {
        it('Redis가 null이면 throw 없이 반환한다(noop)', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);
            await expect(markFetched(cryptoSentinel)).resolves.toBeUndefined();
            expect(mockSet).not.toHaveBeenCalled();
        });

        it('Redis가 있으면 market-news:refresh:<sentinel> 키와 TTL로 set을 호출한다', async () => {
            mockSet.mockResolvedValue('OK');
            await markFetched(cryptoSentinel);
            expect(mockSet).toHaveBeenCalledWith(
                `market-news:refresh:${cryptoSentinel}`,
                '1',
                { ex: MARKET_NEWS_REFRESH_FLAG_TTL_SECONDS }
            );
        });

        it('Redis set이 예외를 던지면 throw 없이 반환한다(graceful degrade)', async () => {
            const errSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            mockSet.mockRejectedValue(new Error('redis down'));
            await expect(markFetched(cryptoSentinel)).resolves.toBeUndefined();
            expect(errSpy).toHaveBeenCalled();
            errSpy.mockRestore();
        });
    });
});
