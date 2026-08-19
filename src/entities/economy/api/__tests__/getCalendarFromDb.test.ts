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
import { ECONOMY_CALENDAR_REVALIDATE_SECONDS } from '@/entities/economy/lib/economyCalendarConstants';

describe('getCalendarFromDb', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        capturedKeyParts = [];
        capturedOptions = {};
        listInRange.mockResolvedValue([]);
    });

    it('passes the correct key array to unstable_cache', async () => {
        await getCalendarFromDb('2026-06-20');
        expect(capturedKeyParts).toEqual(['economy-calendar-db', 'US']);
    });

    it('passes the correct revalidate and tags to unstable_cache', async () => {
        await getCalendarFromDb('2026-06-20');
        expect(capturedOptions).toMatchObject({
            revalidate: ECONOMY_CALENDAR_REVALIDATE_SECONDS,
            tags: ['economy:calendar:us'],
        });
    });

    it('reads the past-window..future-window range around the anchor', async () => {
        await getCalendarFromDb('2026-06-20');
        expect(listInRange).toHaveBeenCalledWith(
            pastWindowStart('2026-06-20'),
            futureWindowEnd('2026-06-20'),
            'US'
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

    /**
     * 리더는 국가별 `unstable_cache` 래퍼를 Map에 메모한다. 그 Map이 국가를 키로
     * 쓰지 않으면 (a) `/economy/kr`이 미국 ISR 엔트리를 그대로 서빙하거나
     * (b) KR 인제스션의 `revalidateTag('economy:calendar:kr')`이 아무것도 못 맞춰
     * `/economy/kr`이 24시간 얼어붙는다. 메모 때문에 순서 의존이라 한 국가만
     * 테스트해서는 절대 드러나지 않는다.
     */
    it('KR은 자기 캐시 키·태그·국가 필터를 쓴다', async () => {
        await getCalendarFromDb('2026-06-20', 'KR');

        expect(capturedKeyParts).toEqual(['economy-calendar-db', 'KR']);
        expect(capturedOptions).toMatchObject({
            tags: ['economy:calendar:kr'],
        });
        expect(listInRange).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            'KR'
        );
    });

    it('KR 조회 뒤에도 US는 여전히 US 키를 쓴다 (래퍼 메모가 뭉개지지 않는다)', async () => {
        await getCalendarFromDb('2026-06-20', 'KR');
        await getCalendarFromDb('2026-06-20', 'US');

        expect(capturedKeyParts).toEqual(['economy-calendar-db', 'US']);
        expect(capturedOptions).toMatchObject({
            tags: ['economy:calendar:us'],
        });
    });
});
