const mocks = vi.hoisted(() => ({
    listInRange: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/entities/economy/api/economicCalendarRepository', () => ({
    DrizzleEconomicCalendarRepository: class {
        listInRange = mocks.listInRange;
    },
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));

import {
    __resetIndicatorWhitelistCacheForTests,
    isTranslatableCalendarIndicator,
    MAX_INDICATOR_NAME_LENGTH,
    WHITELIST_PAST_PADDING_DAYS,
} from '@/entities/economy/api/isTranslatableCalendarIndicator';
import {
    futureWindowEnd,
    pastWindowStart,
    etDateOf,
} from '@/entities/economy/lib/calendarWindow';
import { MS_PER_MINUTE } from '@/shared/config/time';
import { addUtcIsoDays } from '@/shared/lib/isoDate';

describe('isTranslatableCalendarIndicator (public action whitelist)', () => {
    const NOW = new Date('2026-10-06T15:00:00.000Z');
    const US_ONLY = 'US Only Index';
    const KR_ONLY = 'KR Only Index';

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        __resetIndicatorWhitelistCacheForTests();
        mocks.listInRange.mockImplementation(
            async (_from: string, _to: string, country: string) =>
                country === 'US'
                    ? [{ event: `${US_ONLY} (Sep)` }]
                    : [{ event: `${KR_ONLY} (YoY)` }]
        );
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it.each([
        ['empty', ''],
        ['over the length cap', 'A'.repeat(MAX_INDICATOR_NAME_LENGTH + 1)],
    ])(
        'rejects a name that is %s without reading the calendar',
        async (_l, name) => {
            expect(await isTranslatableCalendarIndicator(name)).toBe(false);
            expect(mocks.listInRange).not.toHaveBeenCalled();
        }
    );

    it('accepts a name exactly at the length cap when it is on the calendar', async () => {
        const name = 'B'.repeat(MAX_INDICATOR_NAME_LENGTH);
        mocks.listInRange.mockResolvedValue([{ event: name }]);
        expect(await isTranslatableCalendarIndicator(name)).toBe(true);
    });

    it('rejects names already in the code dictionary (no translation needed)', async () => {
        expect(await isTranslatableCalendarIndicator('Nonfarm Payrolls')).toBe(
            false
        );
        expect(mocks.listInRange).not.toHaveBeenCalled();
    });

    it('accepts a base present in either country window (US ∪ KR)', async () => {
        expect(await isTranslatableCalendarIndicator(US_ONLY)).toBe(true);
        expect(await isTranslatableCalendarIndicator(KR_ONLY)).toBe(true);
        expect(
            await isTranslatableCalendarIndicator('Not On Any Calendar')
        ).toBe(false);
    });

    it('reads each country from the padded past start through the future window end', async () => {
        await isTranslatableCalendarIndicator(US_ONLY);

        const anchor = etDateOf(NOW);
        const from = addUtcIsoDays(
            pastWindowStart(anchor),
            -WHITELIST_PAST_PADDING_DAYS
        );
        expect(mocks.listInRange).toHaveBeenCalledWith(
            from,
            futureWindowEnd(anchor),
            'US'
        );
        expect(mocks.listInRange).toHaveBeenCalledWith(
            from,
            futureWindowEnd(anchor),
            'KR'
        );
        // 서버 창보다 정확히 패딩 일수만큼 이르다 — 묵은 화면의 창을 덮는다.
        expect(from).toBe(
            addUtcIsoDays(pastWindowStart(anchor), -WHITELIST_PAST_PADDING_DAYS)
        );
        expect(from < pastWindowStart(anchor)).toBe(true);
    });

    it('serves repeated checks from the 5-minute cache without a second DB read', async () => {
        await isTranslatableCalendarIndicator(US_ONLY);
        await isTranslatableCalendarIndicator('Not On Any Calendar');
        expect(mocks.listInRange).toHaveBeenCalledTimes(2); // US + KR once

        vi.setSystemTime(new Date(NOW.getTime() + 4 * MS_PER_MINUTE));
        await isTranslatableCalendarIndicator(KR_ONLY);
        expect(mocks.listInRange).toHaveBeenCalledTimes(2);

        vi.setSystemTime(new Date(NOW.getTime() + 6 * MS_PER_MINUTE));
        await isTranslatableCalendarIndicator(KR_ONLY);
        expect(mocks.listInRange).toHaveBeenCalledTimes(4);
    });
});
