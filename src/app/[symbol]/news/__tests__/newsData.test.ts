import type { EarningsReportComparisonItem } from '@/shared/lib/types';

const {
    mockDb,
    mockGetLatestFetchedAt,
    mockGetComparisonItems,
    mockUpsertMany,
    mockGetEarningsReports,
} = vi.hoisted(() => ({
    mockDb: {} as Record<string, unknown>,
    mockGetLatestFetchedAt: vi.fn(),
    mockGetComparisonItems: vi.fn(),
    mockUpsertMany: vi.fn(),
    mockGetEarningsReports: vi.fn(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: mockDb })),
}));

vi.mock('@/entities/earnings-report', () => ({
    DrizzleEarningsReportsRepository: vi.fn().mockImplementation(function () {
        return {
            getLatestFetchedAt: mockGetLatestFetchedAt,
            getComparisonItems: mockGetComparisonItems,
            upsertMany: mockUpsertMany,
        };
    }),
}));

vi.mock('@/shared/api/fmp/fundamentalClient', () => ({
    FmpFundamentalClient: vi.fn().mockImplementation(function () {
        return {
            getEarningsReports: mockGetEarningsReports,
            getGrades: vi.fn(),
        };
    }),
}));

import { getEarningsReportComparison } from '@/app/[symbol]/news/newsData';

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

        it('비교 데이터가 비어 있으면 FMP 로 정규화 데이터를 채운다', async () => {
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

    describe('갱신 실패 시 기존 DB 데이터가 있으면', () => {
        it('비일시 실패는 DB 데이터를 반환하고 서버 로그를 남긴다', async () => {
            const staleFetchedAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
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
            const staleFetchedAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
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
            const staleFetchedAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
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
            const staleFetchedAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
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
