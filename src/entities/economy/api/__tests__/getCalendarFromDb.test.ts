vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({
    unstable_cache:
        (fn: (...a: unknown[]) => unknown) =>
        (...a: unknown[]) =>
            fn(...a),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));

const listInRange = vi.fn();
vi.mock('@/entities/economy/api/economicCalendarRepository', () => ({
    DrizzleEconomicCalendarRepository: class {
        listInRange = listInRange;
    },
}));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { getCalendarFromDb } from '@/entities/economy/api/getCalendarFromDb';
import {
    pastWindowStart,
    futureWindowEnd,
} from '@/entities/economy/lib/calendarWindow';

describe('getCalendarFromDb', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        listInRange.mockResolvedValue([]);
    });

    it('reads the past-window..future-window range around the anchor', async () => {
        await getCalendarFromDb('2026-06-20');
        expect(listInRange).toHaveBeenCalledWith(
            pastWindowStart('2026-06-20'),
            futureWindowEnd('2026-06-20')
        );
    });

    it('returns the rows the repository produced', async () => {
        const event = {
            date: '2026-06-19 08:30:00',
            event: 'X',
            impact: 'High' as const,
            actual: 1,
            estimate: 1,
            previous: 1,
            unit: '%',
        };
        listInRange.mockResolvedValue([event]);
        const events = await getCalendarFromDb('2026-06-20');
        expect(events).toEqual([event]);
    });

    it('degrades to [] on DB failure (graceful, not throw)', async () => {
        listInRange.mockRejectedValue(new Error('neon down'));
        const events = await getCalendarFromDb('2026-06-20');
        expect(events).toEqual([]);
    });
});
