const mocks = vi.hoisted(() => ({
    revalidateTag: vi.fn(),
    isCalendarRecentlyFetched: vi.fn(),
    markCalendarFetched: vi.fn(),
    isCalendarBackfillFresh: vi.fn(),
    markCalendarBackfilled: vi.fn(),
    getCalendarForCountry: vi.fn(),
    upsertEvent: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidateTag: mocks.revalidateTag }));
vi.mock('@/entities/economy/api/calendarRefreshFlag', () => ({
    isCalendarRecentlyFetched: mocks.isCalendarRecentlyFetched,
    markCalendarFetched: mocks.markCalendarFetched,
    isCalendarBackfillFresh: mocks.isCalendarBackfillFresh,
    markCalendarBackfilled: mocks.markCalendarBackfilled,
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
import {
    __resetBackfillMemoForTests,
    ingestEconomicCalendar,
} from '@/entities/economy/api/ingestEconomicCalendar';
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
        __resetBackfillMemoForTests();
        mocks.isCalendarRecentlyFetched.mockResolvedValue(false);
        mocks.markCalendarFetched.mockResolvedValue(undefined);
        mocks.isCalendarBackfillFresh.mockResolvedValue(false);
        mocks.markCalendarBackfilled.mockResolvedValue(undefined);
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
    describe('최근 구간과 오래된 과거 구간', () => {
        // 2026-10-23 12:00 ET
        const NOW = new Date('2026-10-23T16:00:00.000Z');
        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(NOW);
        });
        afterEach(() => {
            vi.useRealTimers();
        });

        const callFor = (from: string) =>
            mocks.getCalendarForCountry.mock.calls.find(
                ([callFrom]) => callFrom === from
            );

        it('미국은 최근 구간만 한 번 읽고 백필 플래그를 보지 않는다', async () => {
            await ingestEconomicCalendar('US', 't');

            expect(mocks.getCalendarForCountry).toHaveBeenCalledTimes(1);
            expect(mocks.getCalendarForCountry).toHaveBeenCalledWith(
                '2026-09-23',
                '2026-11-22',
                'US'
            );
            expect(mocks.isCalendarBackfillFresh).not.toHaveBeenCalled();
            expect(mocks.markCalendarBackfilled).not.toHaveBeenCalled();
        });

        it('한국은 하루 한 번 180일 창의 앞쪽을 함께 읽어 둘 다 쓰고, 다 쓴 뒤 플래그를 세운다', async () => {
            mocks.getCalendarForCountry.mockImplementation(
                async (from: string) =>
                    from === '2026-04-26' ? [event('Old')] : [event('New')]
            );

            await expect(ingestEconomicCalendar('KR', 't')).resolves.toEqual({
                status: 'ok',
                changed: 2,
            });
            expect(callFor('2026-09-23')).toEqual([
                '2026-09-23',
                '2026-11-22',
                'KR',
            ]);
            expect(callFor('2026-04-26')).toEqual([
                '2026-04-26',
                '2026-09-22',
                'KR',
            ]);
            expect(mocks.upsertEvent).toHaveBeenCalledTimes(2);
            expect(mocks.markCalendarBackfilled).toHaveBeenCalledWith('KR');
        });

        it('한국도 앞쪽을 하루 안에 읽었으면 최근 구간만 읽는다', async () => {
            mocks.isCalendarBackfillFresh.mockResolvedValue(true);

            await ingestEconomicCalendar('KR', 't');

            expect(mocks.getCalendarForCountry).toHaveBeenCalledTimes(1);
            expect(callFor('2026-09-23')).toBeDefined();
            expect(mocks.markCalendarBackfilled).not.toHaveBeenCalled();
        });

        it('앞쪽 읽기가 실패해도 최근 구간은 쓰고, 플래그를 세우지 않아 다음 수집이 다시 시도한다', async () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);
            mocks.getCalendarForCountry.mockImplementation(
                async (from: string) => {
                    if (from === '2026-04-26') throw new Error('fmp');
                    return [event('New')];
                }
            );

            await expect(ingestEconomicCalendar('KR', 'lbl')).resolves.toEqual({
                status: 'ok',
                changed: 1,
            });
            expect(mocks.markCalendarBackfilled).not.toHaveBeenCalled();
            expect(errorSpy).toHaveBeenCalledWith(
                '[lbl] FMP backfill fetch failed:',
                expect.any(Error)
            );
            errorSpy.mockRestore();
        });

        it('최근 구간 읽기가 실패하면 앞쪽이 성공해도 쓰지 않고 백필 플래그도 세우지 않는다', async () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);
            mocks.getCalendarForCountry.mockImplementation(
                async (from: string) => {
                    if (from === '2026-09-23') throw new Error('fmp');
                    return [event('Old')];
                }
            );

            await expect(ingestEconomicCalendar('KR', 't')).resolves.toEqual({
                status: 'fetch-failed',
            });
            expect(mocks.upsertEvent).not.toHaveBeenCalled();
            expect(mocks.markCalendarBackfilled).not.toHaveBeenCalled();
            errorSpy.mockRestore();
        });

        it('앞쪽 과거 쓰기가 일부라도 실패하면 플래그를 세우지 않는다(과반이 아니어도)', async () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);
            mocks.getCalendarForCountry.mockImplementation(
                async (from: string) =>
                    from === '2026-04-26'
                        ? [event('Old1'), event('Old2')]
                        : [event('New1'), event('New2'), event('New3')]
            );
            mocks.upsertEvent.mockImplementation(
                async (_country: string, e: EconomicCalendarEvent) => {
                    if (e.event === 'Old2') throw new Error('db');
                    return true;
                }
            );

            await expect(ingestEconomicCalendar('KR', 't')).resolves.toEqual({
                status: 'ok',
                changed: 4,
            });
            expect(mocks.markCalendarBackfilled).not.toHaveBeenCalled();
            errorSpy.mockRestore();
        });

        it('최근 구간 쓰기가 과반 실패하면 앞쪽 과거가 다 써져도 write-failed다', async () => {
            // 합쳐서 세면 앞쪽 행이 분모를 키워 최근 구간의 전면 실패가 'ok'로 묻힌다.
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);
            mocks.getCalendarForCountry.mockImplementation(
                async (from: string) =>
                    from === '2026-04-26'
                        ? [
                              event('Old1'),
                              event('Old2'),
                              event('Old3'),
                              event('Old4'),
                          ]
                        : [event('New1'), event('New2')]
            );
            mocks.upsertEvent.mockImplementation(
                async (_country: string, e: EconomicCalendarEvent) => {
                    if (e.event.startsWith('New')) throw new Error('db');
                    return true;
                }
            );

            await expect(ingestEconomicCalendar('KR', 't')).resolves.toEqual({
                status: 'write-failed',
            });
            errorSpy.mockRestore();
        });

        it('Redis가 백필 플래그를 못 지켜도 같은 프로세스에서는 하루 안에 앞쪽 과거를 다시 읽지 않는다', async () => {
            // Redis 장애 때 isSet은 늘 false다.
            mocks.isCalendarBackfillFresh.mockResolvedValue(false);
            await ingestEconomicCalendar('KR', 't');
            mocks.getCalendarForCountry.mockClear();

            await ingestEconomicCalendar('KR', 't');

            expect(mocks.getCalendarForCountry).toHaveBeenCalledTimes(1);
            expect(callFor('2026-04-26')).toBeUndefined();
        });

        it('앞쪽 과거가 비어 오면 플래그를 세우지 않아 다음 수집이 다시 읽는다(SA-18)', async () => {
            mocks.getCalendarForCountry.mockImplementation(
                async (from: string) =>
                    from === '2026-04-26' ? [] : [event('New')]
            );

            await expect(ingestEconomicCalendar('KR', 't')).resolves.toEqual({
                status: 'ok',
                changed: 1,
            });
            expect(mocks.markCalendarBackfilled).not.toHaveBeenCalled();
        });

        it('두 구간이 모두 비어도 플래그를 세우지 않는다', async () => {
            mocks.getCalendarForCountry.mockResolvedValue([]);

            await expect(ingestEconomicCalendar('KR', 't')).resolves.toEqual({
                status: 'ok',
                changed: 0,
            });
            expect(mocks.markCalendarBackfilled).not.toHaveBeenCalled();
        });

        it('쓰기가 과반 실패하면 백필 플래그를 세우지 않는다', async () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);
            mocks.upsertEvent.mockRejectedValue(new Error('db'));

            await expect(ingestEconomicCalendar('KR', 't')).resolves.toEqual({
                status: 'write-failed',
            });
            expect(mocks.markCalendarBackfilled).not.toHaveBeenCalled();
            errorSpy.mockRestore();
        });
    });
});
