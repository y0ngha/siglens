import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetOrSetCache, mockGetTreasury, provider } = vi.hoisted(() => {
    const mockGetTreasury = vi.fn();
    return {
        mockGetOrSetCache: vi.fn(),
        mockGetTreasury,
        provider: {
            getTreasury: mockGetTreasury,
            getTreasuryReading: undefined as
                | undefined
                | (() => Promise<unknown>),
        },
    };
});
vi.mock('server-only', () => ({}));
vi.mock('@/shared/cache/getOrSetCache', () => ({
    getOrSetCache: mockGetOrSetCache,
}));
vi.mock('@/shared/api/economy/getEconomyProvider', () => ({
    getEconomyProvider: () => provider,
}));

import {
    buildTreasuryCacheKey,
    getFreshTreasuryRates,
    TREASURY_CACHE_TTL_SECONDS,
    TREASURY_FALLBACK_TTL_SECONDS,
} from '../treasuryRatesCache';
import { SECONDS_PER_DAY } from '@/shared/config/time';

describe('treasuryRatesCache', () => {
    beforeEach(() => {
        mockGetOrSetCache.mockReset();
        mockGetTreasury.mockReset();
        provider.getTreasuryReading = undefined;
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-22T12:06:00.000Z'));
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('키는 ET 날짜 기준이다 — UTC 자정을 넘겨도 ET 날짜가 같으면 같은 키', () => {
        // 2026-10-23T02:00Z = ET 10/22 22:00
        expect(buildTreasuryCacheKey(new Date('2026-10-23T02:00:00Z'))).toBe(
            'economy:treasury:v2:2026-10-22'
        );
        expect(buildTreasuryCacheKey(new Date('2026-10-23T05:00:00Z'))).toBe(
            'economy:treasury:v2:2026-10-23'
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

        const call = mockGetOrSetCache.mock.calls.find(
            ([key]) => key === 'economy:treasury:v2:2026-10-22'
        )!;
        const ttl = call[1] as (v: unknown) => number;
        expect(ttl(result)).toBe(TREASURY_CACHE_TTL_SECONDS);
        // 출처를 알리지 않는 공급자(FMP 단독·Fake)는 FMP 출처, 캐시 가능
        expect(result).toEqual({
            treasury: { date: '2026-10-21', year2: 3.6, year10: 5.13 },
            fetchedAt: '2026-10-22T12:06:00.000Z',
            source: 'fmp',
            officialAvailable: true,
        });
    });

    it('출처를 알리는 공급자는 그 출처를 싣고, 재무부를 못 읽어 FMP로 물러난 값은 짧게만 캐시한다', async () => {
        mockGetOrSetCache.mockImplementation(
            async (_key, _ttl, fetcher: () => Promise<unknown>) => fetcher()
        );
        provider.getTreasuryReading = async () => ({
            treasury: { date: '2026-10-20', year2: 4.79, year10: 5.12 },
            source: 'fmp',
            officialAvailable: false,
        });
        const result = await getFreshTreasuryRates();
        expect(result).toMatchObject({
            source: 'fmp',
            officialAvailable: false,
        });
        expect(mockGetTreasury).not.toHaveBeenCalled();
        const call = mockGetOrSetCache.mock.calls.find(
            ([key]) => key === 'economy:treasury:v2:2026-10-22'
        )!;
        const ttl = call[1] as (v: unknown) => number;
        expect(ttl(result)).toBe(TREASURY_FALLBACK_TTL_SECONDS);
        expect(TREASURY_FALLBACK_TTL_SECONDS).toBeLessThan(
            TREASURY_CACHE_TTL_SECONDS
        );
        expect(
            ttl({ ...result!, source: 'us-treasury', officialAvailable: true })
        ).toBe(TREASURY_CACHE_TTL_SECONDS);
    });

    it('공급자가 null이면 null이고, null은 캐시하지 않는다', async () => {
        mockGetOrSetCache.mockImplementation(
            async (_key, _ttl, fetcher: () => Promise<unknown>) => fetcher()
        );
        mockGetTreasury.mockResolvedValue(null);

        await expect(getFreshTreasuryRates()).resolves.toBeNull();
        const call = mockGetOrSetCache.mock.calls.find(
            ([key]) => key === 'economy:treasury:v2:2026-10-22'
        );
        const shouldCache = call![3] as (v: unknown) => boolean;
        expect(shouldCache(null)).toBe(false);
        expect(
            shouldCache({
                treasury: {},
                fetchedAt: 'x',
                source: 'fmp',
                officialAvailable: true,
            })
        ).toBe(true);
    });

    it('캐시·공급자 장애는 null로 내린다', async () => {
        mockGetOrSetCache.mockRejectedValue(new Error('redis down'));
        await expect(getFreshTreasuryRates()).resolves.toBeNull();
    });
});
