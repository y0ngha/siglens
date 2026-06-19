// All vi.mock() calls are hoisted before static imports — factory cannot reference
// outer-scope variables. Access mocked fns via vi.mocked() after import.
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));
vi.mock('@/entities/economy/api/calendarRefreshFlag', () => ({
    isCalendarRecentlyFetched: vi.fn(),
    markCalendarFetched: vi.fn(),
}));
vi.mock('@/shared/api/fmp/FmpEconomyProvider', () => ({
    FmpEconomyProvider: vi.fn(function () {
        return { getCalendar: vi.fn() };
    }),
}));
vi.mock('@/entities/economy/api/economicCalendarRepository', () => ({
    DrizzleEconomicCalendarRepository: vi.fn(function () {
        return { upsertEvent: vi.fn() };
    }),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {} })),
}));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { EconomicCalendarEvent } from '@y0ngha/siglens-core';
import { revalidateTag } from 'next/cache';
import {
    isCalendarRecentlyFetched,
    markCalendarFetched,
} from '@/entities/economy/api/calendarRefreshFlag';
import { FmpEconomyProvider } from '@/shared/api/fmp/FmpEconomyProvider';
import { DrizzleEconomicCalendarRepository } from '@/entities/economy/api/economicCalendarRepository';
import { ensureEconomicCalendarAction } from '@/entities/economy/actions/ensureEconomicCalendarAction';
import { ECONOMY_CALENDAR_CACHE_TAG } from '@/entities/economy/lib/economyCalendarConstants';

const EVENT: EconomicCalendarEvent = {
    date: '2026-06-13 08:30:00',
    event: 'Core CPI MoM (May)',
    impact: 'High',
    actual: 0.4,
    estimate: 0.3,
    previous: 0.2,
    unit: '%',
};

describe('ensureEconomicCalendarAction', () => {
    let getCalendar: ReturnType<typeof vi.fn>;
    let upsertEvent: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(isCalendarRecentlyFetched).mockResolvedValue(false);
        vi.mocked(markCalendarFetched).mockResolvedValue(undefined);

        // Set up fresh mocks on the class instances created by the action
        getCalendar = vi.fn().mockResolvedValue([EVENT]);
        upsertEvent = vi.fn().mockResolvedValue(true);
        vi.mocked(FmpEconomyProvider).mockImplementation(function () {
            return { getCalendar } as unknown as FmpEconomyProvider;
        });
        vi.mocked(DrizzleEconomicCalendarRepository).mockImplementation(
            function () {
                return {
                    upsertEvent,
                } as unknown as DrizzleEconomicCalendarRepository;
            }
        );
    });

    it('skips fetch when recently fetched', async () => {
        vi.mocked(isCalendarRecentlyFetched).mockResolvedValue(true);
        await ensureEconomicCalendarAction();
        expect(getCalendar).not.toHaveBeenCalled();
        expect(upsertEvent).not.toHaveBeenCalled();
    });

    it('fetches, upserts, and revalidates the calendar tag on change', async () => {
        await ensureEconomicCalendarAction();
        expect(markCalendarFetched).toHaveBeenCalledOnce();
        expect(getCalendar).toHaveBeenCalledOnce();
        expect(upsertEvent).toHaveBeenCalledWith('US', EVENT);
        expect(revalidateTag).toHaveBeenCalledWith(
            ECONOMY_CALENDAR_CACHE_TAG,
            'max'
        );
    });

    it('does not revalidate when no row changed', async () => {
        upsertEvent.mockResolvedValue(false);
        await ensureEconomicCalendarAction();
        expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('swallows FMP failure without throwing or revalidating', async () => {
        getCalendar.mockRejectedValue(new Error('fmp down'));
        await expect(ensureEconomicCalendarAction()).resolves.toBeUndefined();
        expect(upsertEvent).not.toHaveBeenCalled();
        expect(revalidateTag).not.toHaveBeenCalled();
    });
});
