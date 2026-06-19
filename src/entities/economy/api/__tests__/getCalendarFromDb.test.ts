vi.mock('server-only', () => ({}));

/**
 * unstable_cache mock: call-through이지만 (fn, keyParts, options) 인자를 캡처해
 * 캐시 키·revalidate·tags 계약을 단언할 수 있게 한다.
 *
 * 모듈-레벨 unstable_cache(fn, keyParts, options) 구조:
 * - keyParts: ['economy-calendar-db']
 * - anchorEt는 반환된 래퍼 함수의 인자로 전달(auto-keyed by Next.js)
 */
let capturedKeyParts: string[] = [];
let capturedOptions: Record<string, unknown> = {};
vi.mock('next/cache', () => ({
    unstable_cache:
        (
            fn: (...a: unknown[]) => unknown,
            keyParts: string[],
            options: Record<string, unknown>
        ) =>
        (...a: unknown[]) => {
            capturedKeyParts = keyParts;
            capturedOptions = options;
            return fn(...a);
        },
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
import {
    ECONOMY_CALENDAR_CACHE_TAG,
    ECONOMY_CALENDAR_REVALIDATE_SECONDS,
} from '@/entities/economy/lib/economyCalendarConstants';

describe('getCalendarFromDb', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        capturedKeyParts = [];
        capturedOptions = {};
        listInRange.mockResolvedValue([]);
    });

    it('passes the correct key array to unstable_cache', async () => {
        await getCalendarFromDb('2026-06-20');
        expect(capturedKeyParts).toEqual(['economy-calendar-db']);
    });

    it('passes the correct revalidate and tags to unstable_cache', async () => {
        await getCalendarFromDb('2026-06-20');
        expect(capturedOptions).toMatchObject({
            revalidate: ECONOMY_CALENDAR_REVALIDATE_SECONDS,
            tags: [ECONOMY_CALENDAR_CACHE_TAG],
        });
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
