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
    isAnalysisRecentlyRun,
    markAnalysisRun,
} from '@/entities/economy/api/calendarAnalysisRefreshFlag';
import {
    CALENDAR_ANALYSIS_REFRESH_FLAG_KEY,
    CALENDAR_ANALYSIS_REFRESH_FLAG_TTL_SECONDS,
} from '@/entities/economy/lib/economyCalendarConstants';

/** 국가별 키 — 전역 키 하나면 먼저 방문한 국가가 다른 국가의 분석 창을 태운다. */
const US_ANALYSIS_KEY = `${CALENDAR_ANALYSIS_REFRESH_FLAG_KEY}:us`;

describe('calendarAnalysisRefreshFlag', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getRedisClient).mockReturnValue(
            mockRedis as unknown as import('@upstash/redis').Redis
        );
    });

    describe('isAnalysisRecentlyRun', () => {
        it('returns true when Redis is present and key exists', async () => {
            mockGet.mockResolvedValue('1');
            expect(await isAnalysisRecentlyRun('US')).toBe(true);
            expect(mockGet).toHaveBeenCalledWith(US_ANALYSIS_KEY);
        });

        it('returns false when Redis is present and key is absent', async () => {
            mockGet.mockResolvedValue(null);
            expect(await isAnalysisRecentlyRun('US')).toBe(false);
        });

        it('returns false when Redis client is null', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);
            expect(await isAnalysisRecentlyRun('US')).toBe(false);
            expect(mockGet).not.toHaveBeenCalled();
        });

        it('returns false when redis.get throws', async () => {
            mockGet.mockRejectedValue(new Error('redis timeout'));
            expect(await isAnalysisRecentlyRun('US')).toBe(false);
        });
    });

    describe('markAnalysisRun', () => {
        it('calls set with the correct key and TTL when Redis is present', async () => {
            await markAnalysisRun('US');
            expect(mockSet).toHaveBeenCalledWith(US_ANALYSIS_KEY, '1', {
                ex: CALENDAR_ANALYSIS_REFRESH_FLAG_TTL_SECONDS,
            });
        });

        it('is a noop (no throw) when Redis client is null', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);
            await expect(markAnalysisRun('US')).resolves.toBeUndefined();
            expect(mockSet).not.toHaveBeenCalled();
        });

        it('does not throw when redis.set throws', async () => {
            mockSet.mockRejectedValue(new Error('redis timeout'));
            await expect(markAnalysisRun('US')).resolves.toBeUndefined();
        });
    });

    /**
     * 키가 국가별로 갈리지 않으면 `/economy` 한 번 방문이 한국 분석 창까지 태워
     * KR 이벤트가 영원히 미분석으로 남는다 — 오류도 로그도 없다.
     */
    describe('국가별 키 분리', () => {
        it('KR 키는 :kr로 끝나고 US 키와 다르다', async () => {
            mockGet.mockResolvedValue(null);

            await isAnalysisRecentlyRun('KR');
            const krKey = mockGet.mock.calls[0]?.[0] as string;

            expect(krKey).toBe(`${CALENDAR_ANALYSIS_REFRESH_FLAG_KEY}:kr`);
            expect(krKey).not.toBe(US_ANALYSIS_KEY);
        });

        it('markAnalysisRun도 같은 국가별 키에 쓴다', async () => {
            await markAnalysisRun('KR');

            expect(mockSet).toHaveBeenCalledWith(
                `${CALENDAR_ANALYSIS_REFRESH_FLAG_KEY}:kr`,
                expect.anything(),
                { ex: CALENDAR_ANALYSIS_REFRESH_FLAG_TTL_SECONDS }
            );
        });
    });
});
