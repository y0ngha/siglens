import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetOrSetCache, mockGetCalendarsByCountry } = vi.hoisted(() => ({
    mockGetOrSetCache: vi.fn(),
    mockGetCalendarsByCountry: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/shared/cache/getOrSetCache', () => ({
    getOrSetCache: mockGetOrSetCache,
}));
vi.mock('@/shared/api/economy/getEconomyProvider', () => ({
    getEconomyProvider: () => ({
        getCalendarsByCountry: mockGetCalendarsByCountry,
    }),
}));

import {
    buildEconomicCalendarRangeCacheKey,
    ECONOMIC_CALENDAR_RANGE_TTL_SECONDS,
    getEconomicCalendarRange,
} from '../economicCalendarRangeCache';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

const KEY = 'economy:calendar-range:v3:2026-10-23:2027-01-01';

describe('getEconomicCalendarRange', () => {
    beforeEach(() => {
        mockGetOrSetCache.mockReset();
        mockGetCalendarsByCountry.mockReset();
        // 캐시를 건너뛰고 fetcher를 바로 실행한다.
        mockGetOrSetCache.mockImplementation(
            (_key: string, _ttl: number, fetcher: () => unknown) => fetcher()
        );
    });

    it('범위 하나를 미국·한국 묶음으로 한 번 읽어 3시간 캐시하고, 요청한 국가만 돌려준다', async () => {
        const us = [{ event: 'Fed Interest Rate Decision' }];
        const kr = [{ event: 'Interest Rate Decision' }];
        mockGetCalendarsByCountry.mockResolvedValue({
            byCountry: { US: us, KR: kr },
            sourceRows: 2,
        });

        await expect(
            getEconomicCalendarRange('KR', '2026-10-23', '2027-01-01')
        ).resolves.toBe(kr);
        expect(mockGetCalendarsByCountry).toHaveBeenCalledWith(
            '2026-10-23',
            '2027-01-01',
            ['US', 'KR']
        );
        expect(mockGetOrSetCache).toHaveBeenCalledWith(
            KEY,
            3 * SECONDS_PER_HOUR,
            expect.any(Function),
            expect.any(Function)
        );
        expect(ECONOMIC_CALENDAR_RANGE_TTL_SECONDS).toBe(3 * SECONDS_PER_HOUR);
    });

    it('미국과 한국이 같은 범위면 같은 키를 쓴다 — FMP 전 국가 응답을 두 번 받지 않는다', async () => {
        mockGetCalendarsByCountry.mockResolvedValue({
            byCountry: { US: [], KR: [] },
            sourceRows: 1,
        });
        await getEconomicCalendarRange('US', '2026-10-23', '2027-01-01');
        await getEconomicCalendarRange('KR', '2026-10-23', '2027-01-01');
        const keys = mockGetOrSetCache.mock.calls.map(([key]) => key);
        expect(keys).toEqual([KEY, KEY]);
    });

    it('원본 행이 없을 때만 캐시하지 않는다 — 한 국가가 비어도 원본에 행이 있으면 진짜 결과다(SA-18)', async () => {
        mockGetCalendarsByCountry.mockResolvedValue({
            byCountry: { US: [], KR: [] },
            sourceRows: 0,
        });
        await getEconomicCalendarRange('KR', '2026-10-23', '2027-01-01');
        const shouldCache = mockGetOrSetCache.mock.calls.find(
            ([key]) => key === KEY
        )?.[3] as (value: { sourceRows: number }) => boolean;
        expect(shouldCache({ sourceRows: 0 })).toBe(false);
        expect(shouldCache({ sourceRows: 37 })).toBe(true);
    });

    it('범위가 다르면 키가 달라 다른 범위의 캐시를 재사용하지 않는다', () => {
        expect(
            buildEconomicCalendarRangeCacheKey('2026-10-23', '2027-01-01')
        ).not.toBe(
            buildEconomicCalendarRangeCacheKey('2026-10-24', '2027-01-02')
        );
    });

    it('공급자 실패를 빈 배열로 바꾸지 않고 그대로 던진다', async () => {
        // 빈 배열은 "일정 없음"으로 읽혀 에이전트가 없는 일정을 단언하게 된다.
        mockGetCalendarsByCountry.mockRejectedValue(new Error('fmp 429'));
        await expect(
            getEconomicCalendarRange('US', '2026-10-23', '2027-01-01')
        ).rejects.toThrow('fmp 429');
    });
});
