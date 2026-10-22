import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetOrSetCache, mockGetTreasury } = vi.hoisted(() => ({
    mockGetOrSetCache: vi.fn(),
    mockGetTreasury: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/shared/cache/getOrSetCache', () => ({
    getOrSetCache: mockGetOrSetCache,
}));
vi.mock('@/shared/api/economy/getEconomyProvider', () => ({
    getEconomyProvider: () => ({ getTreasury: mockGetTreasury }),
}));

import {
    buildTreasuryCacheKey,
    getFreshTreasuryRates,
    TREASURY_CACHE_TTL_SECONDS,
} from '../treasuryRatesCache';
import { SECONDS_PER_DAY } from '@/shared/config/time';

describe('treasuryRatesCache', () => {
    beforeEach(() => {
        mockGetOrSetCache.mockReset();
        mockGetTreasury.mockReset();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-22T12:06:00.000Z'));
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('키는 ET 날짜 기준이다 — UTC 자정을 넘겨도 ET 날짜가 같으면 같은 키', () => {
        // 2026-10-23T02:00Z = ET 10/22 22:00
        expect(buildTreasuryCacheKey(new Date('2026-10-23T02:00:00Z'))).toBe(
            'economy:treasury:2026-10-22'
        );
        expect(buildTreasuryCacheKey(new Date('2026-10-23T05:00:00Z'))).toBe(
            'economy:treasury:2026-10-23'
        );
    });

    it('TTL은 하루보다 짧다(스냅샷 24h 캐시와 분리하는 이유)', () => {
        expect(TREASURY_CACHE_TTL_SECONDS).toBeLessThan(SECONDS_PER_DAY / 4);
    });

    it('ET 날짜 키 + 짧은 TTL로 읽고, 읽은 시각을 함께 싣는다', async () => {
        mockGetOrSetCache.mockImplementation(
            async (_key, _ttl, fetcher: () => Promise<unknown>) => fetcher()
        );
        mockGetTreasury.mockResolvedValue({
            date: '2026-10-21',
            year2: 3.6,
            year10: 5.13,
        });

        const result = await getFreshTreasuryRates();

        expect(mockGetOrSetCache).toHaveBeenCalledWith(
            'economy:treasury:2026-10-22',
            TREASURY_CACHE_TTL_SECONDS,
            expect.any(Function),
            expect.any(Function)
        );
        expect(result).toEqual({
            treasury: { date: '2026-10-21', year2: 3.6, year10: 5.13 },
            fetchedAt: '2026-10-22T12:06:00.000Z',
        });
    });

    it('공급자가 null이면 null이고, null은 캐시하지 않는다', async () => {
        mockGetOrSetCache.mockImplementation(
            async (_key, _ttl, fetcher: () => Promise<unknown>) => fetcher()
        );
        mockGetTreasury.mockResolvedValue(null);

        await expect(getFreshTreasuryRates()).resolves.toBeNull();
        const call = mockGetOrSetCache.mock.calls.find(
            ([key]) => key === 'economy:treasury:2026-10-22'
        );
        const shouldCache = call![3] as (v: unknown) => boolean;
        expect(shouldCache(null)).toBe(false);
        expect(shouldCache({ treasury: {}, fetchedAt: 'x' })).toBe(true);
    });

    it('캐시·공급자 장애는 null로 내린다', async () => {
        mockGetOrSetCache.mockRejectedValue(new Error('redis down'));
        await expect(getFreshTreasuryRates()).resolves.toBeNull();
    });
});
