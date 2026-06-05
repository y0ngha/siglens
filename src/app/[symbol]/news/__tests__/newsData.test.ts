import type { EarningsReportComparisonItem } from '@/shared/lib/types';
import {
    EARNINGS_REPORT_FMP_LIMIT,
    EARNINGS_REPORT_STALE_MS,
} from '@/entities/earnings-report';
import { MS_PER_HOUR } from '@/shared/config/time';

const {
    mockDb,
    mockGetLatestFetchedAt,
    mockGetComparisonItems,
    mockUpsertMany,
    mockGetEarningsReports,
    mockGetGrades,
} = vi.hoisted(() => ({
    mockDb: {} as Record<string, unknown>,
    mockGetLatestFetchedAt: vi.fn(),
    mockGetComparisonItems: vi.fn(),
    mockUpsertMany: vi.fn(),
    mockGetEarningsReports: vi.fn(),
    mockGetGrades: vi.fn(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: mockDb })),
}));

vi.mock('@/entities/earnings-report', async importOriginal => ({
    ...(await importOriginal<typeof import('@/entities/earnings-report')>()),
    DrizzleEarningsReportsRepository: vi.fn().mockImplementation(function () {
        return {
            getLatestFetchedAt: mockGetLatestFetchedAt,
            getComparisonItems: mockGetComparisonItems,
            upsertMany: mockUpsertMany,
        };
    }),
}));

vi.mock('@/shared/api/fmp/fundamentalClient', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@/shared/api/fmp/fundamentalClient')
    >()),
    FmpFundamentalClient: vi.fn().mockImplementation(function () {
        return {
            getEarningsReports: mockGetEarningsReports,
            getGrades: mockGetGrades,
        };
    }),
}));

// Redis 레이어는 getOrSetCache.test.ts에서 독립적으로 커버한다. 여기서는 fetcher로
// 위임만 시켜, Redis 환경변수가 설정된 CI에서도 실제 I/O 없이 격리되게 한다.
vi.mock('@/shared/cache/getOrSetCache', () => ({
    getOrSetCache: vi.fn(
        (_key: string, _ttl: number, fetcher: () => Promise<unknown>) =>
            fetcher()
    ),
}));

const { markerStore, fakeRedis } = vi.hoisted(() => {
    const markerStore = new Map<string, unknown>();
    const fakeRedis = {
        get: vi.fn(async (key: string) =>
            markerStore.has(key) ? markerStore.get(key) : null
        ),
        set: vi.fn(async (key: string, value: unknown) => {
            markerStore.set(key, value);
        }),
    };
    return { markerStore, fakeRedis };
});
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: () => fakeRedis,
}));

import {
    getEarningsReportComparison,
    getGradeEvents,
} from '@/app/[symbol]/news/newsData';
import type { GradesEvent } from '@y0ngha/siglens-core';

const COMPARISON_ITEM: EarningsReportComparisonItem = {
    symbol: 'AAPL',
    earningsDate: '2026-04-30',
    epsActual: 2.01,
    epsEstimated: 1.95,
    revenueActual: 111_184_000_000,
    revenueEstimated: 109_457_600_000,
    lastUpdated: '2026-05-10',
    period: 'past',
    slot: 'recent-or-future',
};

describe('getEarningsReportComparison 함수는', () => {
    beforeEach(() => {
        markerStore.clear();
        vi.clearAllMocks();
        mockGetLatestFetchedAt.mockResolvedValue(new Date());
        mockGetComparisonItems.mockResolvedValue([COMPARISON_ITEM]);
        mockGetEarningsReports.mockResolvedValue([COMPARISON_ITEM]);
        mockUpsertMany.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('DB 캐시가 유효할 때', () => {
        it('FMP 를 호출하지 않고 DB 데이터를 반환한다', async () => {
            await expect(
                getEarningsReportComparison('AAPL', '2026-05-10')
            ).resolves.toEqual([COMPARISON_ITEM]);

            expect(mockGetEarningsReports).not.toHaveBeenCalled();
            expect(mockUpsertMany).not.toHaveBeenCalled();
        });

        it('fetchedAt이 fresh면 비교 데이터가 비어 있어도 FMP를 재호출하지 않는다 (24h gate 우회 방지)', async () => {
            mockGetComparisonItems.mockResolvedValue([]);
            // beforeEach: mockGetLatestFetchedAt = new Date() (fresh)

            await expect(
                getEarningsReportComparison('AAPL', '2026-05-10')
            ).resolves.toEqual([]);

            expect(mockGetEarningsReports).not.toHaveBeenCalled();
            expect(mockUpsertMany).not.toHaveBeenCalled();
        });
    });

    describe('DB 캐시가 만료됐을 때 (stale)', () => {
        it('비교 데이터가 비어 있으면 FMP 로 정규화 데이터를 채운다', async () => {
            const staleFetchedAt = new Date(
                Date.now() - (EARNINGS_REPORT_STALE_MS + MS_PER_HOUR)
            );
            mockGetLatestFetchedAt.mockResolvedValue(staleFetchedAt);
            mockGetComparisonItems
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([COMPARISON_ITEM]);

            await expect(
                getEarningsReportComparison('AAPL', '2026-05-10')
            ).resolves.toEqual([COMPARISON_ITEM]);

            expect(mockGetEarningsReports).toHaveBeenCalledWith('AAPL', 5);
            expect(mockUpsertMany).toHaveBeenCalledWith([COMPARISON_ITEM]);
            expect(mockGetComparisonItems).toHaveBeenCalledTimes(2);
        });
    });

    describe('빈-응답 마커 (#567)', () => {
        it('빈 마커가 있으면 stale이어도 FMP를 호출하지 않고 기존 비교 데이터를 반환한다', async () => {
            markerStore.set('earnings:empty:XLK', 1);
            const staleFetchedAt = new Date(
                Date.now() - (EARNINGS_REPORT_STALE_MS + MS_PER_HOUR)
            );
            mockGetLatestFetchedAt.mockResolvedValue(staleFetchedAt);
            mockGetComparisonItems.mockResolvedValue([COMPARISON_ITEM]);

            await expect(
                getEarningsReportComparison('XLK', '2026-05-10')
            ).resolves.toEqual([COMPARISON_ITEM]);

            expect(mockGetEarningsReports).not.toHaveBeenCalled();
            expect(mockUpsertMany).not.toHaveBeenCalled();
        });

        it('FMP가 빈 응답을 주면 빈 마커를 set한다', async () => {
            const staleFetchedAt = new Date(
                Date.now() - (EARNINGS_REPORT_STALE_MS + MS_PER_HOUR)
            );
            mockGetLatestFetchedAt.mockResolvedValue(staleFetchedAt);
            mockGetComparisonItems.mockResolvedValue([]);
            mockGetEarningsReports.mockResolvedValue([]);

            await getEarningsReportComparison('XLK', '2026-05-10');

            expect(mockGetEarningsReports).toHaveBeenCalledWith(
                'XLK',
                EARNINGS_REPORT_FMP_LIMIT
            );
            expect(markerStore.has('earnings:empty:XLK')).toBe(true);
        });

        it('FMP가 데이터를 주면 빈 마커를 set하지 않는다', async () => {
            const staleFetchedAt = new Date(
                Date.now() - (EARNINGS_REPORT_STALE_MS + MS_PER_HOUR)
            );
            mockGetLatestFetchedAt.mockResolvedValue(staleFetchedAt);
            mockGetComparisonItems.mockResolvedValue([COMPARISON_ITEM]);
            mockGetEarningsReports.mockResolvedValue([COMPARISON_ITEM]);

            await getEarningsReportComparison('AAPL', '2026-05-10');

            expect(markerStore.has('earnings:empty:AAPL')).toBe(false);
        });
    });

    describe('갱신 실패 시 기존 DB 데이터가 있으면', () => {
        it('비일시 실패는 DB 데이터를 반환하고 서버 로그를 남긴다', async () => {
            const staleFetchedAt = new Date(
                Date.now() - (EARNINGS_REPORT_STALE_MS + MS_PER_HOUR)
            );
            mockGetLatestFetchedAt.mockResolvedValue(staleFetchedAt);
            mockGetEarningsReports.mockRejectedValue(new Error('rate limited'));
            vi.spyOn(console, 'warn').mockImplementation(() => undefined);

            await expect(
                getEarningsReportComparison('AAPL', '2026-05-10')
            ).resolves.toEqual([COMPARISON_ITEM]);

            expect(mockUpsertMany).not.toHaveBeenCalled();
            expect(console.warn).toHaveBeenCalled();
        });

        it('FMP 429 실패는 DB 데이터를 반환하고 서버 로그를 남기지 않는다', async () => {
            const staleFetchedAt = new Date(
                Date.now() - (EARNINGS_REPORT_STALE_MS + MS_PER_HOUR)
            );
            mockGetLatestFetchedAt.mockResolvedValue(staleFetchedAt);
            mockGetEarningsReports.mockRejectedValue(
                new Error('FMP earnings 429')
            );
            vi.spyOn(console, 'warn').mockImplementation(() => undefined);

            await expect(
                getEarningsReportComparison('AAPL', '2026-05-10')
            ).resolves.toEqual([COMPARISON_ITEM]);

            expect(mockUpsertMany).not.toHaveBeenCalled();
            expect(console.warn).not.toHaveBeenCalled();
        });
    });

    describe('갱신 실패 시 기존 DB 데이터가 없으면', () => {
        it('비일시 실패는 로그를 남기고 예외를 전파한다', async () => {
            const staleFetchedAt = new Date(
                Date.now() - (EARNINGS_REPORT_STALE_MS + MS_PER_HOUR)
            );
            const error = new Error('network down');
            mockGetLatestFetchedAt.mockResolvedValue(staleFetchedAt);
            mockGetComparisonItems.mockResolvedValue([]);
            mockGetEarningsReports.mockRejectedValue(error);
            vi.spyOn(console, 'warn').mockImplementation(() => undefined);

            await expect(
                getEarningsReportComparison('AAPL', '2026-05-10')
            ).rejects.toBe(error);

            expect(mockUpsertMany).not.toHaveBeenCalled();
            expect(console.warn).toHaveBeenCalled();
        });

        it('FMP 429 실패는 로그 없이 예외를 전파한다', async () => {
            const staleFetchedAt = new Date(
                Date.now() - (EARNINGS_REPORT_STALE_MS + MS_PER_HOUR)
            );
            const error = new Error('FMP earnings 429');
            mockGetLatestFetchedAt.mockResolvedValue(staleFetchedAt);
            mockGetComparisonItems.mockResolvedValue([]);
            mockGetEarningsReports.mockRejectedValue(error);
            vi.spyOn(console, 'warn').mockImplementation(() => undefined);

            await expect(
                getEarningsReportComparison('AAPL', '2026-05-10')
            ).rejects.toBe(error);

            expect(mockUpsertMany).not.toHaveBeenCalled();
            expect(console.warn).not.toHaveBeenCalled();
        });
    });
});

describe('getGradeEvents 함수는', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('fundamentalClient.getGrades에 위임해 등급 이벤트를 반환한다', async () => {
        const events: GradesEvent[] = [
            {
                symbol: 'AAPL',
                date: '2026-05-01',
                gradingCompany: 'Morgan Stanley',
                previousGrade: 'Hold',
                newGrade: 'Buy',
                action: 'upgrade',
            },
        ];
        mockGetGrades.mockResolvedValue(events);

        await expect(getGradeEvents('AAPL')).resolves.toEqual(events);
        expect(mockGetGrades).toHaveBeenCalledWith('AAPL');
    });

    it('getGrades가 빈 배열을 반환하면 그대로 위임한다', async () => {
        mockGetGrades.mockResolvedValue([]);

        await expect(getGradeEvents('AAPL')).resolves.toEqual([]);
        expect(mockGetGrades).toHaveBeenCalledWith('AAPL');
    });
});
