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

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { getRedisClient } from '@/shared/cache/redisClient';
import {
    isCalendarRecentlyFetched,
    markCalendarFetched,
} from '@/entities/economy/api/calendarRefreshFlag';
import {
    CALENDAR_REFRESH_FLAG_KEY,
    CALENDAR_REFRESH_FLAG_TTL_SECONDS,
} from '@/entities/economy/lib/economyCalendarConstants';

/**
 * 인제스션 스로틀 플래그. **키가 국가별로 갈려야 한다** — 전역 키 하나면
 * `/economy` 한 번 방문이 한국 인제스션 창까지 태워서 `economic_calendar`에 KR
 * 행이 영영 안 들어온다. 그 상태는 조용하다: 액션이 오류를 삼키고, 캘린더는
 * 자체 빈 상태를 그리며, 로그도 남지 않는다.
 */
describe('calendarRefreshFlag', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getRedisClient).mockReturnValue(
            mockRedis as unknown as import('@upstash/redis').Redis
        );
    });

    it('국가마다 다른 키를 읽는다', async () => {
        mockGet.mockResolvedValue(null);

        await isCalendarRecentlyFetched('US');
        await isCalendarRecentlyFetched('KR');

        expect(mockGet).toHaveBeenNthCalledWith(
            1,
            `${CALENDAR_REFRESH_FLAG_KEY}:us`
        );
        expect(mockGet).toHaveBeenNthCalledWith(
            2,
            `${CALENDAR_REFRESH_FLAG_KEY}:kr`
        );
    });

    it('키가 있으면 true, 없으면 false', async () => {
        mockGet.mockResolvedValue('1');
        expect(await isCalendarRecentlyFetched('KR')).toBe(true);

        mockGet.mockResolvedValue(null);
        expect(await isCalendarRecentlyFetched('KR')).toBe(false);
    });

    it('마킹도 국가별 키에 TTL과 함께 쓴다', async () => {
        await markCalendarFetched('KR');

        expect(mockSet).toHaveBeenCalledWith(
            `${CALENDAR_REFRESH_FLAG_KEY}:kr`,
            expect.anything(),
            { ex: CALENDAR_REFRESH_FLAG_TTL_SECONDS }
        );
    });

    it('Redis가 없으면 항상 false로 떨어져 인제스션을 막지 않는다', async () => {
        vi.mocked(getRedisClient).mockReturnValue(null);

        expect(await isCalendarRecentlyFetched('KR')).toBe(false);
    });

    it('Redis 오류를 삼켜 마킹이 인제스션을 죽이지 않는다', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockSet.mockRejectedValue(new Error('redis down'));

        await expect(markCalendarFetched('KR')).resolves.toBeUndefined();
        errSpy.mockRestore();
    });
});
