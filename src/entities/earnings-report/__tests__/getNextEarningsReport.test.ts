import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EarningsCalendarItem } from '@y0ngha/siglens-core';
import type { SiglensDatabase } from '@/shared/db/types';
import {
    DrizzleEarningsReportsRepository,
    EARNINGS_REPORT_FMP_LIMIT,
    EARNINGS_REPORT_STALE_MS,
    getNextEarningsReport,
} from '@/entities/earnings-report';
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
vi.mock('@/shared/lib/dateKey', () => ({
    todayKstIsoDate: () => '2026-05-25',
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
// (MISTAKES §Tests #14). fake timer 대신 Date.now만 스파이해 async/mockResolvedValue와의
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
    // api.ts 내부에서 DrizzleEarningsReportsRepository를 같은 모듈로 직접 생성하므로
    // 모듈 모킹 대신 prototype 메서드를 spy한다(실제 DB 호출 없이 동작 검증).
    let getLatestFetchedAt: ReturnType<typeof vi.spyOn>;
    let upsertMany: ReturnType<typeof vi.spyOn>;
    let getNextForSymbol: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        store.clear();
        vi.clearAllMocks();
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
    });

    afterEach(() => {
        vi.restoreAllMocks();
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

    it('passes todayKstIsoDate to getNextForSymbol', async () => {
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
