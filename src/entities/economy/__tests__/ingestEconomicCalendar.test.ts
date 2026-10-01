const mocks = vi.hoisted(() => ({
    revalidateTag: vi.fn(),
    isCalendarRecentlyFetched: vi.fn(),
    markCalendarFetched: vi.fn(),
    getCalendarForCountry: vi.fn(),
    upsertEvent: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidateTag: mocks.revalidateTag }));
vi.mock('@/entities/economy/api/calendarRefreshFlag', () => ({
    isCalendarRecentlyFetched: mocks.isCalendarRecentlyFetched,
    markCalendarFetched: mocks.markCalendarFetched,
}));
vi.mock('@/shared/api/fmp/FmpEconomyProvider', () => ({
    FmpEconomyProvider: class {
        getCalendarForCountry = mocks.getCalendarForCountry;
    },
}));
vi.mock('@/entities/economy/api/economicCalendarRepository', () => ({
    DrizzleEconomicCalendarRepository: class {
        upsertEvent = mocks.upsertEvent;
    },
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));

import type { EconomicCalendarEvent } from '@y0ngha/siglens-core';
import { ingestEconomicCalendar } from '@/entities/economy/api/ingestEconomicCalendar';
import { economyCalendarCacheTag } from '@/entities/economy/lib/economyCalendarConstants';

const event = (name: string): EconomicCalendarEvent => ({
    date: '2026-06-13 08:30:00',
    event: name,
    impact: 'High',
    actual: 0.4,
    estimate: 0.3,
    previous: 0.2,
    unit: '%',
});

describe('ingestEconomicCalendar', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.isCalendarRecentlyFetched.mockResolvedValue(false);
        mocks.markCalendarFetched.mockResolvedValue(undefined);
        mocks.getCalendarForCountry.mockResolvedValue([event('A')]);
        mocks.upsertEvent.mockResolvedValue(true);
    });

    it('플래그가 살아 있으면 recently-fetched로 단락한다', async () => {
        mocks.isCalendarRecentlyFetched.mockResolvedValue(true);

        await expect(ingestEconomicCalendar('US', 't')).resolves.toEqual({
            status: 'recently-fetched',
        });
        expect(mocks.markCalendarFetched).not.toHaveBeenCalled();
        expect(mocks.getCalendarForCountry).not.toHaveBeenCalled();
    });

    it('fetch 전에 플래그를 세우고 국가를 넘겨 FMP를 부른다', async () => {
        await ingestEconomicCalendar('KR', 't');

        expect(mocks.markCalendarFetched).toHaveBeenCalledWith('KR');
        expect(mocks.getCalendarForCountry).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            'KR'
        );
    });

    it('FMP가 실패하면 fetch-failed — 쓰기도 무효화도 없다', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        mocks.getCalendarForCountry.mockRejectedValue(new Error('fmp'));

        await expect(ingestEconomicCalendar('US', 'lbl')).resolves.toEqual({
            status: 'fetch-failed',
        });
        expect(mocks.upsertEvent).not.toHaveBeenCalled();
        expect(mocks.revalidateTag).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledWith(
            '[lbl] FMP fetch failed:',
            expect.any(Error)
        );
        errorSpy.mockRestore();
    });

    it('결과가 비면 ok·changed 0 — 무효화하지 않는다', async () => {
        mocks.getCalendarForCountry.mockResolvedValue([]);

        await expect(ingestEconomicCalendar('US', 't')).resolves.toEqual({
            status: 'ok',
            changed: 0,
        });
        expect(mocks.upsertEvent).not.toHaveBeenCalled();
        expect(mocks.revalidateTag).not.toHaveBeenCalled();
    });

    it('같은 id 이벤트는 dedup해서 한 번만 upsert한다', async () => {
        mocks.getCalendarForCountry.mockResolvedValue([
            event('A'),
            event('A'),
            event('B'),
        ]);

        const result = await ingestEconomicCalendar('US', 't');

        expect(mocks.upsertEvent).toHaveBeenCalledTimes(2);
        expect(result).toEqual({ status: 'ok', changed: 2 });
    });

    it('changed > 0이면 국가별 캘린더 태그를 턴다', async () => {
        await ingestEconomicCalendar('KR', 't');

        expect(mocks.revalidateTag).toHaveBeenCalledTimes(1);
        expect(mocks.revalidateTag).toHaveBeenCalledWith(
            economyCalendarCacheTag('KR'),
            'max'
        );
    });

    it('upsert가 전부 변경 없음(false)이면 changed 0이고 털지 않는다', async () => {
        mocks.upsertEvent.mockResolvedValue(false);

        await expect(ingestEconomicCalendar('US', 't')).resolves.toEqual({
            status: 'ok',
            changed: 0,
        });
        expect(mocks.revalidateTag).not.toHaveBeenCalled();
    });

    it('과반 upsert 실패면 write-failed로 abort하고 털지 않는다', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        mocks.getCalendarForCountry.mockResolvedValue([
            event('A'),
            event('B'),
            event('C'),
        ]);
        mocks.upsertEvent
            .mockResolvedValueOnce(true)
            .mockRejectedValueOnce(new Error('db'))
            .mockRejectedValueOnce(new Error('db'));

        await expect(ingestEconomicCalendar('US', 't')).resolves.toEqual({
            status: 'write-failed',
        });
        expect(mocks.revalidateTag).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    it('소수 upsert 실패는 성공분만 세고 계속 진행한다', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        mocks.getCalendarForCountry.mockResolvedValue([
            event('A'),
            event('B'),
            event('C'),
        ]);
        mocks.upsertEvent
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(true)
            .mockRejectedValueOnce(new Error('db'));

        await expect(ingestEconomicCalendar('US', 't')).resolves.toEqual({
            status: 'ok',
            changed: 2,
        });
        expect(mocks.revalidateTag).toHaveBeenCalledTimes(1);
        errorSpy.mockRestore();
    });
});
