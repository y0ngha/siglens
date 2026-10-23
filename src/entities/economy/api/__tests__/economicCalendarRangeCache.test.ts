import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetOrSetCache, mockGetCalendar } = vi.hoisted(() => ({
    mockGetOrSetCache: vi.fn(),
    mockGetCalendar: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/shared/cache/getOrSetCache', () => ({
    getOrSetCache: mockGetOrSetCache,
}));
vi.mock('@/shared/api/economy/getEconomyProvider', () => ({
    getEconomyProvider: () => ({ getCalendar: mockGetCalendar }),
}));

import {
    buildEconomicCalendarRangeCacheKey,
    ECONOMIC_CALENDAR_RANGE_TTL_SECONDS,
    getEconomicCalendarRange,
} from '../economicCalendarRangeCache';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

describe('getEconomicCalendarRange', () => {
    beforeEach(() => {
        mockGetOrSetCache.mockReset();
        mockGetCalendar.mockReset();
        // 캐시를 건너뛰고 fetcher를 바로 실행한다.
        mockGetOrSetCache.mockImplementation(
            (_key: string, _ttl: number, fetcher: () => unknown) => fetcher()
        );
    });

    it('범위를 키로 3시간 캐시하고, 그 범위를 공급자에 그대로 묻는다', async () => {
        const rows = [{ event: 'Fed Interest Rate Decision' }];
        mockGetCalendar.mockResolvedValue(rows);
        await expect(
            getEconomicCalendarRange('2026-10-23', '2027-01-01')
        ).resolves.toBe(rows);
        expect(mockGetOrSetCache).toHaveBeenCalledWith(
            'economy:calendar-range:v1:2026-10-23:2027-01-01',
            3 * SECONDS_PER_HOUR,
            expect.any(Function),
            expect.any(Function)
        );
        expect(mockGetCalendar).toHaveBeenCalledWith(
            '2026-10-23',
            '2027-01-01'
        );
        expect(ECONOMIC_CALENDAR_RANGE_TTL_SECONDS).toBe(3 * SECONDS_PER_HOUR);
    });

    it('빈 결과는 캐시하지 않는다 — FMP 장애의 200 []가 3시간 "일정 0건"으로 굳지 않게', async () => {
        mockGetCalendar.mockResolvedValue([]);
        await getEconomicCalendarRange('2026-10-23', '2027-01-01');
        const shouldCache = mockGetOrSetCache.mock.calls.find(
            ([key]) => key === 'economy:calendar-range:v1:2026-10-23:2027-01-01'
        )?.[3] as (rows: unknown[]) => boolean;
        expect(shouldCache([])).toBe(false);
        expect(shouldCache([{ event: 'CPI' }])).toBe(true);
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
        mockGetCalendar.mockRejectedValue(new Error('fmp 429'));
        await expect(
            getEconomicCalendarRange('2026-10-23', '2027-01-01')
        ).rejects.toThrow('fmp 429');
    });
});
