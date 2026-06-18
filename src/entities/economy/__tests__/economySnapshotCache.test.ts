vi.mock('server-only', () => ({}));
vi.mock('@/shared/cache/getOrSetCache');
vi.mock('@/shared/api/economy/getEconomyProvider');

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { getEconomyProvider } from '@/shared/api/economy/getEconomyProvider';
import { getEconomySnapshot } from '@/entities/economy/api/economySnapshotCache';
import { ECONOMY_INDICATORS } from '@/shared/config/economyIndicators';
import type { EconomyProvider } from '@/shared/api/economy/EconomyProvider';

const mockGetOrSetCache = vi.mocked(getOrSetCache);
const mockGetEconomyProvider = vi.mocked(getEconomyProvider);

const POINT = { date: '2026-05-01', value: 3.63 };
const PREV_POINT = { date: '2026-04-01', value: 3.58 };

function fakeProvider(
    overrides: Partial<EconomyProvider> = {}
): EconomyProvider {
    return {
        getIndicator: vi.fn(async (name: string) => ({
            name,
            latest: POINT,
            previous: PREV_POINT,
            trend: [POINT, PREV_POINT],
        })),
        getTreasury: vi.fn(async () => ({
            date: '2026-06-15',
            year2: 4.07,
            year10: 4.47,
        })),
        getCalendar: vi.fn(async () => []),
        ...overrides,
    };
}

describe('getEconomySnapshot', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // getOrSetCache는 fetcher를 즉시 호출해 그 결과를 그대로 반환(단위테스트용 통과).
        mockGetOrSetCache.mockImplementation(async (_k, _t, fetcher) =>
            fetcher()
        );
    });

    it('레지스트리 N개 지표 + treasury + calendar를 조립한다', async () => {
        mockGetEconomyProvider.mockReturnValue(fakeProvider());
        const snap = await getEconomySnapshot();
        expect(snap.indicators).toHaveLength(ECONOMY_INDICATORS.length);
        expect(snap.indicators[0].latest).toEqual(POINT);
        expect(snap.treasury?.year10).toBe(4.47);
        expect(snap.calendar).toEqual([]);
    });

    it('일부 지표 fetch 실패는 비어있는 시리즈로 graceful', async () => {
        mockGetEconomyProvider.mockReturnValue(
            fakeProvider({
                getIndicator: vi.fn(async (name: string) => {
                    if (name === 'GDP') throw new Error('FMP fail');
                    return {
                        name,
                        latest: POINT,
                        previous: null,
                        trend: [POINT],
                    };
                }),
            })
        );
        const snap = await getEconomySnapshot();
        const gdp = snap.indicators.find(i => i.name === 'GDP');
        expect(gdp?.latest).toBeNull();
        expect(gdp?.trend).toEqual([]);
        const others = snap.indicators.filter(i => i.name !== 'GDP');
        expect(others.every(i => i.latest !== null)).toBe(true);
    });

    it('treasury 실패는 null로 graceful — 다른 축은 살아남음', async () => {
        mockGetEconomyProvider.mockReturnValue(
            fakeProvider({
                getTreasury: vi.fn(async () => {
                    throw new Error('treasury fail');
                }),
            })
        );
        const snap = await getEconomySnapshot();
        expect(snap.treasury).toBeNull();
        expect(snap.indicators[0].latest).toEqual(POINT);
    });

    it('calendar 실패는 빈 배열로 graceful', async () => {
        mockGetEconomyProvider.mockReturnValue(
            fakeProvider({
                getCalendar: vi.fn(async () => {
                    throw new Error('calendar fail');
                }),
            })
        );
        const snap = await getEconomySnapshot();
        expect(snap.calendar).toEqual([]);
        expect(snap.treasury?.year10).toBe(4.47);
    });

    it('shouldCache 가드: 빈 스냅샷은 캐시되지 않음', async () => {
        mockGetEconomyProvider.mockReturnValue(
            fakeProvider({
                getIndicator: vi.fn(async (name: string) => ({
                    name,
                    latest: null,
                    previous: null,
                    trend: [],
                })),
                getTreasury: vi.fn(async () => null),
                getCalendar: vi.fn(async () => []),
            })
        );
        await getEconomySnapshot();
        // getOrSetCache(key, ttl, fetcher, shouldCache?) — 4번째 인자가 shouldCache.
        const [, , , shouldCache] = mockGetOrSetCache.mock.calls[0];
        expect(typeof shouldCache).toBe('function');
        // 빈 스냅샷을 넣으면 false 반환
        const emptySnap = {
            indicators: ECONOMY_INDICATORS.map(m => ({
                name: m.name,
                latest: null,
                previous: null,
                trend: [],
            })),
            treasury: null,
            calendar: [],
        };
        expect(shouldCache!(emptySnap)).toBe(false);
    });

    it('shouldCache 가드: 값이 있는 스냅샷은 캐시 허용(true)', async () => {
        mockGetEconomyProvider.mockReturnValue(fakeProvider());
        await getEconomySnapshot();
        const [, , , shouldCache] = mockGetOrSetCache.mock.calls[0];
        const goodSnap = {
            indicators: [
                { name: 'x', latest: POINT, previous: null, trend: [POINT] },
            ],
            treasury: { date: '2026-06-15', year2: 4.07, year10: 4.47 },
            calendar: [],
        };
        expect(shouldCache!(goodSnap)).toBe(true);
    });

    it('모든 9개 indicator가 동시에 throw해도 page는 부분 성공 (treasury/calendar 살아남음)', async () => {
        mockGetEconomyProvider.mockReturnValue(
            fakeProvider({
                getIndicator: vi.fn(async () => {
                    throw new Error('all indicators fail');
                }),
            })
        );
        const snap = await getEconomySnapshot();
        // 모든 indicator 실패 → 빈 시리즈로 대체되지만 배열 자체는 레지스트리 크기 유지
        expect(snap.indicators).toHaveLength(ECONOMY_INDICATORS.length);
        snap.indicators.forEach(i => {
            expect(i.latest).toBeNull();
            expect(i.trend).toEqual([]);
        });
        // treasury·calendar는 별도 축이라 살아있어야 한다
        expect(snap.treasury?.year10).toBe(4.47);
        // fakeProvider()의 기본 getCalendar는 `async () => []`를 반환하므로 [] 맞다.
        // calendar 축은 provider를 override하지 않았으므로 throw 없이 빈 배열로 정상 반환.
        expect(snap.calendar).toEqual([]);
    });

    it('UTC-vs-ET 경계: UTC 03:00(= ET 전날 23:00, EDT 기준)에 getCalendar의 from 인자가 ET 날짜 기준임을 검증', async () => {
        /**
         * 2026-06-17 UTC 03:00 = 2026-06-16 23:00 EDT(-4h).
         * UTC 기준이면 from='2026-06-17', ET 기준이면 from='2026-06-16'.
         *
         * vi.useFakeTimers()로 시스템 시각을 UTC 03:00으로 고정한 뒤
         * getEconomySnapshot()을 호출해 provider.getCalendar에 전달된
         * from 인자가 ET 기준 전날('2026-06-16')인지 직접 검사한다.
         */
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-17T03:00:00Z'));

        try {
            const mockProvider = fakeProvider();
            mockGetEconomyProvider.mockReturnValue(mockProvider);

            await getEconomySnapshot();

            const [from] = vi.mocked(mockProvider.getCalendar).mock.calls[0];
            // ET 기준 날짜는 '2026-06-16' (UTC 03:00 = ET 전날 23:00)
            expect(from).toBe('2026-06-16');
        } finally {
            vi.useRealTimers();
        }
    });
});
