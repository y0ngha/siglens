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
    isIndicatorTranslationPending,
    markIndicatorTranslationPending,
} from '@/entities/economy/api/indicatorTranslationFlag';
import {
    INDICATOR_TRANSLATION_FLAG_PREFIX,
    INDICATOR_TRANSLATION_FLAG_TTL_SECONDS,
} from '@/entities/economy/lib/indicatorTranslationConstants';

describe('indicatorTranslationFlag', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getRedisClient).mockReturnValue(
            mockRedis as unknown as import('@upstash/redis').Redis
        );
    });

    it('returns false and does not call get when Redis is null', async () => {
        vi.mocked(getRedisClient).mockReturnValue(null);
        expect(await isIndicatorTranslationPending('CPI YoY')).toBe(false);
        expect(mockGet).not.toHaveBeenCalled();
    });

    it('returns true when the flag is set', async () => {
        mockGet.mockResolvedValue('1');
        expect(await isIndicatorTranslationPending('CPI YoY')).toBe(true);
    });

    it('returns false when the flag is absent', async () => {
        mockGet.mockResolvedValue(null);
        expect(await isIndicatorTranslationPending('CPI YoY')).toBe(false);
    });

    it('sets the pending flag with the TTL', async () => {
        await markIndicatorTranslationPending('CPI YoY');
        expect(mockSet).toHaveBeenCalledWith(
            `${INDICATOR_TRANSLATION_FLAG_PREFIX}:CPI YoY`,
            '1',
            { ex: INDICATOR_TRANSLATION_FLAG_TTL_SECONDS }
        );
    });

    it('is a no-op when Redis is null on mark', async () => {
        vi.mocked(getRedisClient).mockReturnValue(null);
        await markIndicatorTranslationPending('CPI YoY');
        expect(mockSet).not.toHaveBeenCalled();
    });

    it('returns false when redis.get throws', async () => {
        mockGet.mockRejectedValue(new Error('redis timeout'));
        expect(await isIndicatorTranslationPending('CPI YoY')).toBe(false);
    });

    it('does not throw when redis.set throws on mark', async () => {
        mockSet.mockRejectedValue(new Error('redis timeout'));
        await expect(
            markIndicatorTranslationPending('CPI YoY')
        ).resolves.toBeUndefined();
    });
});
