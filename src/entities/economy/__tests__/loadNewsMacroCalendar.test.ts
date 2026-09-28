vi.mock('server-only', () => ({}));
vi.mock('@/shared/cache/getOrSetCache');
vi.mock('@/shared/api/economy/getEconomyProvider');

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { EconomicCalendarEvent } from '@y0ngha/siglens-core';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { getEconomyProvider } from '@/shared/api/economy/getEconomyProvider';
import type { EconomyProvider } from '@/shared/api/economy/EconomyProvider';
import { loadNewsMacroCalendar } from '@/entities/economy/api/loadNewsMacroCalendar';

const mockGetOrSetCache = vi.mocked(getOrSetCache);
const mockGetEconomyProvider = vi.mocked(getEconomyProvider);

function event(
    date: string,
    impact: EconomicCalendarEvent['impact'],
    name = 'CPI'
): EconomicCalendarEvent {
    return {
        date,
        event: name,
        impact,
        actual: null,
        estimate: null,
        previous: null,
        unit: '%',
    };
}

function providerWith(
    getCalendar: EconomyProvider['getCalendar']
): EconomyProvider {
    return {
        getIndicator: vi.fn(),
        getTreasury: vi.fn(),
        getCalendar: vi.fn(getCalendar),
    };
}

describe('loadNewsMacroCalendar', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // 02:00 UTC 09-29 = ET 09-28 22:00 — ET로 계산하면 창이 하루 밀려 실패한다.
        vi.useFakeTimers({ now: new Date('2026-09-29T02:00:00Z') });
        mockGetOrSetCache.mockImplementation(async (_k, _t, fetcher) =>
            fetcher()
        );
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('queries today(UTC)-2d .. today+14d and keys the cache by that window', async () => {
        const provider = providerWith(async () => []);
        mockGetEconomyProvider.mockReturnValue(provider);

        await loadNewsMacroCalendar();

        expect(provider.getCalendar).toHaveBeenCalledWith(
            '2026-09-27',
            '2026-10-13'
        );
        expect(mockGetOrSetCache).toHaveBeenCalledWith(
            'economy:news-macro-calendar:2026-09-27:2026-10-13',
            expect.any(Number),
            expect.any(Function)
        );
    });

    it('keeps only High-impact events, sorted ascending by date', async () => {
        mockGetEconomyProvider.mockReturnValue(
            providerWith(async () => [
                event('2026-10-05 12:30:00', 'High', 'NFP'),
                event('2026-09-29 14:00:00', 'Medium'),
                event('2026-09-27 12:30:00', 'High', 'CPI'),
                event('2026-10-01 10:00:00', 'Low'),
            ])
        );

        const result = await loadNewsMacroCalendar();

        expect(result.map(e => e.event)).toEqual(['CPI', 'NFP']);
    });

    it('returns [] when the provider throws', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockGetEconomyProvider.mockReturnValue(
            providerWith(async () => {
                throw new Error('FMP down');
            })
        );

        await expect(loadNewsMacroCalendar()).resolves.toEqual([]);
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });
});
