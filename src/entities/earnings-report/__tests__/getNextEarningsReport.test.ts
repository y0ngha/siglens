import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EarningsCalendarItem } from '@y0ngha/siglens-core';
import type { SiglensDatabase } from '@/shared/db/types';
import { DrizzleEarningsReportsRepository } from '@/entities/earnings-report/server/earningsReportsRepository';
import {
    EARNINGS_REPORT_FMP_LIMIT,
    getNextEarningsReport,
    getNextEarningsSchedule,
} from '@/entities/earnings-report/api';
import { EARNINGS_REPORT_STALE_MS } from '@/entities/earnings-report/lib/isEarningsReportStale';
import { MS_PER_HOUR } from '@/shared/config/time';

// getNextEarningsReport는 getFundamentalDataProvider().getEarningsReports만 호출하므로
// provider factory를 직접 모킹한다(내부 CachedFundamentalProvider/FMP 체인 불필요).
const { mockGetEarningsReports } = vi.hoisted(() => ({
    mockGetEarningsReports: vi.fn(),
}));
vi.mock('@/shared/api/fmp/getFundamentalDataProvider', () => ({
    getFundamentalDataProvider: () => ({
        getEarningsReports: mockGetEarningsReports,
    }),
}));
// Yahoo 실적 힌트는 기본 "없음" — 대조 테스트만 값을 준다(실제 Yahoo로 나가지 않는다).
const { mockHint } = vi.hoisted(() => ({ mockHint: vi.fn() }));
vi.mock('@/entities/analyst-views/server/loadEarningsHint', () => ({
    loadEarningsHintBounded: mockHint,
}));
vi.mock('@/shared/lib/etTimeUtils', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/etTimeUtils')>()),
    kstDateKey: () => '2026-05-25',
}));

const { store, fakeRedis } = vi.hoisted(() => {
    const store = new Map<string, unknown>();
    const fakeRedis = {
        get: vi.fn(async (key: string) =>
            store.has(key) ? store.get(key) : null
        ),
        set: vi.fn(async (key: string, value: unknown) => {
            store.set(key, value);
        }),
    };
    return { store, fakeRedis };
});
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: () => fakeRedis,
}));

const fakeDb = {} as SiglensDatabase;

// getNextEarningsReport 내부 Date.now()를 고정해 staleness 경계를 결정적으로 만든다
// (TESTING.md#TE-7). fake timer 대신 Date.now만 스파이해 async/mockResolvedValue와의
// 상호작용(타이머 기반 hang)을 피한다.
const NOW = new Date('2026-05-25T12:00:00Z').getTime();

const nextEarnings: EarningsCalendarItem = {
    symbol: 'AAPL',
    earningsDate: '2026-07-30',
    epsActual: null,
    epsEstimated: 1.86,
    revenueActual: null,
    revenueEstimated: 107_618_800_000,
    lastUpdated: '2026-05-10',
};

describe('getNextEarningsReport', () => {
    // api.ts가 DrizzleEarningsReportsRepository를 주입받지 않고 직접 `new`하므로
    // 모듈 모킹 대신 prototype 메서드를 spy한다(실제 DB 호출 없이 동작 검증).
    let getLatestFetchedAt: ReturnType<typeof vi.spyOn>;
    let upsertMany: ReturnType<typeof vi.spyOn>;
    let getNextForSymbol: ReturnType<typeof vi.spyOn>;
    let pruneSupersededUpcoming: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        store.clear();
        vi.clearAllMocks();
        mockHint.mockResolvedValue(null);
        vi.spyOn(Date, 'now').mockReturnValue(NOW);
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        getLatestFetchedAt = vi.spyOn(
            DrizzleEarningsReportsRepository.prototype,
            'getLatestFetchedAt'
        );
        upsertMany = vi
            .spyOn(DrizzleEarningsReportsRepository.prototype, 'upsertMany')
            .mockResolvedValue(undefined);
        getNextForSymbol = vi.spyOn(
            DrizzleEarningsReportsRepository.prototype,
            'getNextForSymbol'
        );
        pruneSupersededUpcoming = vi
            .spyOn(
                DrizzleEarningsReportsRepository.prototype,
                'pruneSupersededUpcoming'
            )
            .mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('한국 종목에 추정 실적일(yahoo isEstimate)만 있으면 분석 경로는 dateConfirmed:false로, 에이전트 경로는 추정 표시와 함께 받는다', async () => {
        getLatestFetchedAt.mockResolvedValue(new Date(Date.now() - 1000));
        const estimated = {
            symbol: '005930.KS',
            earningsDate: '2026-07-30',
            epsActual: null,
            epsEstimated: null,
            revenueActual: null,
            revenueEstimated: null,
            lastUpdated: '2026-05-25',
            dateConfirmed: false,
        };
        vi.spyOn(
            DrizzleEarningsReportsRepository.prototype,
            'getNextScheduleForSymbol'
        ).mockResolvedValue(estimated);

        const { dateConfirmed: _schedule, ...calendarFields } = estimated;
        await expect(
            getNextEarningsReport('005930.KS', fakeDb)
        ).resolves.toEqual({ ...calendarFields, dateConfirmed: false });
        await expect(
            getNextEarningsSchedule('005930.KS', fakeDb)
        ).resolves.toEqual(estimated);
    });

    // 대조의 "오늘"은 실제 시계(ET)다 — 힌트 날짜를 먼 미래로 두어 실행 시각과 무관하게 한다.
    it('Yahoo가 다른 날짜를 확정했으면 그 날짜로 바꾸고 dateConfirmed를 싣지 않는다', async () => {
        getLatestFetchedAt.mockResolvedValue(new Date(Date.now() - 1000));
        getNextForSymbol.mockResolvedValue({
            ...nextEarnings,
            earningsDate: '2030-07-30',
        });
        mockHint.mockResolvedValue({
            date: '2030-07-28',
            isEstimate: false,
            session: 'after_market',
            callAt: null,
        });

        const result = await getNextEarningsReport('AAPL', fakeDb);
        expect(result).toEqual({ ...nextEarnings, earningsDate: '2030-07-28' });
        expect(result).not.toHaveProperty('dateConfirmed');
        expect(mockHint).toHaveBeenCalledWith('AAPL');
    });

    it('Yahoo가 같은 날짜를 추정이라고 하면 dateConfirmed:false를 싣는다', async () => {
        getLatestFetchedAt.mockResolvedValue(new Date(Date.now() - 1000));
        getNextForSymbol.mockResolvedValue({
            ...nextEarnings,
            earningsDate: '2030-07-30',
        });
        mockHint.mockResolvedValue({
            date: '2030-07-30',
            isEstimate: true,
            session: null,
            callAt: null,
        });

        await expect(getNextEarningsReport('AAPL', fakeDb)).resolves.toEqual({
            ...nextEarnings,
            earningsDate: '2030-07-30',
            dateConfirmed: false,
        });
    });

    it('다음 실적 행이 없으면(크립토 등) Yahoo 힌트를 부르지 않는다', async () => {
        getLatestFetchedAt.mockResolvedValue(new Date(Date.now() - 1000));
        getNextForSymbol.mockResolvedValue(null);

        await expect(getNextEarningsReport('BTCUSD', fakeDb)).resolves.toBe(
            null
        );
        expect(mockHint).not.toHaveBeenCalled();
    });

    it('fresh data skips FMP call and returns next earnings from DB', async () => {
        // fetchedAt within 24 hours → not stale
        getLatestFetchedAt.mockResolvedValue(new Date(Date.now() - 1000));
        getNextForSymbol.mockResolvedValue(nextEarnings);

        const result = await getNextEarningsReport('AAPL', fakeDb);

        expect(result).toEqual(nextEarnings);
        expect(mockGetEarningsReports).not.toHaveBeenCalled();
        expect(upsertMany).not.toHaveBeenCalled();
    });

    it('stale data triggers FMP fetch and upsert before returning', async () => {
        // fetchedAt older than the 24h gate → stale
        getLatestFetchedAt.mockResolvedValue(
            new Date(Date.now() - (EARNINGS_REPORT_STALE_MS + MS_PER_HOUR))
        );
        mockGetEarningsReports.mockResolvedValue([
            {
                symbol: 'AAPL',
                earningsDate: '2026-07-30',
                epsActual: null,
                epsEstimated: 1.86,
                revenueActual: null,
                revenueEstimated: 107_618_800_000,
                lastUpdated: '2026-05-10',
                rawPayload: {},
            },
        ]);
        getNextForSymbol.mockResolvedValue(nextEarnings);

        const result = await getNextEarningsReport('AAPL', fakeDb);

        expect(result).toEqual(nextEarnings);
        expect(mockGetEarningsReports).toHaveBeenCalledWith(
            'AAPL',
            EARNINGS_REPORT_FMP_LIMIT
        );
        expect(upsertMany).toHaveBeenCalledTimes(1);
        expect(upsertMany).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    symbol: 'AAPL',
                    earningsDate: '2026-07-30',
                }),
            ])
        );
        // 옮겨진 예정일의 옛 행을 같은 응답·같은 기준일(KST 오늘)로 정리한다.
        expect(pruneSupersededUpcoming).toHaveBeenCalledWith(
            'AAPL',
            expect.arrayContaining([
                expect.objectContaining({ earningsDate: '2026-07-30' }),
            ]),
            '2026-05-25'
        );
    });

    it('null fetchedAt is treated as stale and triggers FMP fetch', async () => {
        getLatestFetchedAt.mockResolvedValue(null);
        mockGetEarningsReports.mockResolvedValue([]);
        getNextForSymbol.mockResolvedValue(null);

        const result = await getNextEarningsReport('AAPL', fakeDb);

        expect(result).toBeNull();
        expect(mockGetEarningsReports).toHaveBeenCalledWith(
            'AAPL',
            EARNINGS_REPORT_FMP_LIMIT
        );
    });

    it('FMP failure is swallowed and DB result is still returned', async () => {
        getLatestFetchedAt.mockResolvedValue(null);
        mockGetEarningsReports.mockRejectedValue(new Error('FMP timeout'));
        getNextForSymbol.mockResolvedValue(nextEarnings);

        const result = await getNextEarningsReport('AAPL', fakeDb);

        expect(result).toEqual(nextEarnings);
        expect(upsertMany).not.toHaveBeenCalled();
        // 갱신이 실패하면 아무것도 지우지 않는다.
        expect(pruneSupersededUpcoming).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledWith(
            '[getNextEarningsReport] FMP refresh failed:',
            expect.any(Error)
        );
    });

    it('returns null when DB has no upcoming earnings', async () => {
        getLatestFetchedAt.mockResolvedValue(new Date());
        getNextForSymbol.mockResolvedValue(null);

        const result = await getNextEarningsReport('AAPL', fakeDb);

        expect(result).toBeNull();
    });

    it('passes today (KST) to getNextForSymbol', async () => {
        getLatestFetchedAt.mockResolvedValue(new Date());
        getNextForSymbol.mockResolvedValue(null);

        await getNextEarningsReport('TSLA', fakeDb);

        expect(getNextForSymbol).toHaveBeenCalledWith('TSLA', '2026-05-25');
    });

    it('빈 마커가 있으면 stale이어도 FMP를 호출하지 않는다 (cache-miss 루프 방지)', async () => {
        store.set('earnings:empty:XLK', 1);
        getLatestFetchedAt.mockResolvedValue(null);
        getNextForSymbol.mockResolvedValue(null);

        const result = await getNextEarningsReport('XLK', fakeDb);

        expect(result).toBeNull();
        expect(mockGetEarningsReports).not.toHaveBeenCalled();
        expect(upsertMany).not.toHaveBeenCalled();
    });

    it('FMP가 빈 응답을 주면 빈 마커를 set한다', async () => {
        getLatestFetchedAt.mockResolvedValue(null);
        mockGetEarningsReports.mockResolvedValue([]);
        getNextForSymbol.mockResolvedValue(null);

        await getNextEarningsReport('XLK', fakeDb);

        expect(mockGetEarningsReports).toHaveBeenCalledWith(
            'XLK',
            EARNINGS_REPORT_FMP_LIMIT
        );
        expect(store.has('earnings:empty:XLK')).toBe(true);
    });

    it('FMP가 데이터를 주면 빈 마커를 set하지 않는다', async () => {
        getLatestFetchedAt.mockResolvedValue(null);
        mockGetEarningsReports.mockResolvedValue([
            {
                symbol: 'AAPL',
                earningsDate: '2026-07-30',
                epsActual: null,
                epsEstimated: 1.86,
                revenueActual: null,
                revenueEstimated: 107_618_800_000,
                lastUpdated: '2026-05-10',
                rawPayload: {},
            },
        ]);
        getNextForSymbol.mockResolvedValue(nextEarnings);

        await getNextEarningsReport('AAPL', fakeDb);

        expect(store.has('earnings:empty:AAPL')).toBe(false);
    });
});

describe('getNextEarningsSchedule', () => {
    beforeEach(() => {
        store.clear();
        vi.clearAllMocks();
        mockHint.mockResolvedValue(null);
        vi.spyOn(Date, 'now').mockReturnValue(NOW);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('신선하면 갱신 없이 확정 여부를 붙인 일정을 KST 오늘 기준으로 읽는다', async () => {
        vi.spyOn(
            DrizzleEarningsReportsRepository.prototype,
            'getLatestFetchedAt'
        ).mockResolvedValue(new Date(NOW - 1000));
        const getSchedule = vi
            .spyOn(
                DrizzleEarningsReportsRepository.prototype,
                'getNextScheduleForSymbol'
            )
            .mockResolvedValue({ ...nextEarnings, dateConfirmed: null });

        await expect(getNextEarningsSchedule('AAPL', fakeDb)).resolves.toEqual({
            ...nextEarnings,
            dateConfirmed: null,
        });
        expect(getSchedule).toHaveBeenCalledWith('AAPL', '2026-05-25');
        expect(mockGetEarningsReports).not.toHaveBeenCalled();
    });
});
