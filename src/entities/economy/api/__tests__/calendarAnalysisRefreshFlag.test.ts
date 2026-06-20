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
            expect(await isAnalysisRecentlyRun()).toBe(true);
            expect(mockGet).toHaveBeenCalledWith(
                CALENDAR_ANALYSIS_REFRESH_FLAG_KEY
            );
        });

        it('returns false when Redis is present and key is absent', async () => {
            mockGet.mockResolvedValue(null);
            expect(await isAnalysisRecentlyRun()).toBe(false);
        });

        it('returns false when Redis client is null', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);
            expect(await isAnalysisRecentlyRun()).toBe(false);
            expect(mockGet).not.toHaveBeenCalled();
        });

        it('returns false when redis.get throws', async () => {
            mockGet.mockRejectedValue(new Error('redis timeout'));
            expect(await isAnalysisRecentlyRun()).toBe(false);
        });
    });

    describe('markAnalysisRun', () => {
        it('calls set with the correct key and TTL when Redis is present', async () => {
            await markAnalysisRun();
            expect(mockSet).toHaveBeenCalledWith(
                CALENDAR_ANALYSIS_REFRESH_FLAG_KEY,
                '1',
                { ex: CALENDAR_ANALYSIS_REFRESH_FLAG_TTL_SECONDS }
            );
        });

        it('is a noop (no throw) when Redis client is null', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);
            await expect(markAnalysisRun()).resolves.toBeUndefined();
            expect(mockSet).not.toHaveBeenCalled();
        });

        it('does not throw when redis.set throws', async () => {
            mockSet.mockRejectedValue(new Error('redis timeout'));
            await expect(markAnalysisRun()).resolves.toBeUndefined();
        });
    });
});
