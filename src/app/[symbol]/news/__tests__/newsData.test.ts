import { vi } from 'vitest';
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
    DrizzleEarningsReportsRepository: vi.fn().mockImplementation(function() { return {
        getLatestFetchedAt: mockGetLatestFetchedAt,
        getComparisonItems: mockGetComparisonItems,
        upsertMany: mockUpsertMany,
    }; }),
}));

vi.mock('@/shared/api/fmp/fundamentalClient', () => ({
    FmpFundamentalClient: vi.fn().mockImplementation(function() { return {
        getEarningsReports: mockGetEarningsReports,
        getGrades: vi.fn(),
    }; }),
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

describe('newsData getEarningsReportComparison', () => {
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

    it('DB 비교 데이터가 있고 최신이면 FMP 를 호출하지 않는다', async () => {
        await expect(
            getEarningsReportComparison('AAPL', '2026-05-10')
        ).resolves.toEqual([COMPARISON_ITEM]);

        expect(mockGetEarningsReports).not.toHaveBeenCalled();
        expect(mockUpsertMany).not.toHaveBeenCalled();
    });

    it('fetchedAt 이 최신이어도 비교 데이터가 비어 있으면 FMP 로 정규화 데이터를 채운다', async () => {
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

    it('FMP 갱신 실패 시 기존 DB 비교 데이터를 반환하고 예외를 전파하지 않는다', async () => {
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
});
