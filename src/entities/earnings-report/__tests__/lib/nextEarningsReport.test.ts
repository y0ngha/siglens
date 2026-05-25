import type { EarningsCalendarItem } from '@y0ngha/siglens-core';
import type { SiglensDatabase } from '@/shared/db/types';

const {
    mockGetLatestFetchedAt,
    mockUpsertMany,
    mockGetNextForSymbol,
    mockGetEarningsReports,
} = vi.hoisted(() => ({
    mockGetLatestFetchedAt: vi.fn(),
    mockUpsertMany: vi.fn(),
    mockGetNextForSymbol: vi.fn(),
    mockGetEarningsReports: vi.fn(),
}));

vi.mock('@/entities/earnings-report', () => ({
    DrizzleEarningsReportsRepository: class {
        getLatestFetchedAt = mockGetLatestFetchedAt;
        upsertMany = mockUpsertMany;
        getNextForSymbol = mockGetNextForSymbol;
    },
}));

vi.mock('@/shared/api/fmp/fundamentalClient', () => ({
    FmpFundamentalClient: class {
        getEarningsReports = mockGetEarningsReports;
    },
}));

vi.mock('@/shared/lib/dateKey', () => ({
    todayKstIsoDate: () => '2026-05-25',
}));

import { getNextEarningsReport } from '@/entities/earnings-report/lib/nextEarningsReport';

const fakeDb = {} as SiglensDatabase;

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
    beforeEach(() => {
        vi.clearAllMocks();
        mockUpsertMany.mockResolvedValue(undefined);
    });

    it('fresh data skips FMP call and returns next earnings from DB', async () => {
        // fetchedAt within 24 hours → not stale
        mockGetLatestFetchedAt.mockResolvedValue(new Date(Date.now() - 1000));
        mockGetNextForSymbol.mockResolvedValue(nextEarnings);

        const result = await getNextEarningsReport('AAPL', fakeDb);

        expect(result).toEqual(nextEarnings);
        expect(mockGetEarningsReports).not.toHaveBeenCalled();
        expect(mockUpsertMany).not.toHaveBeenCalled();
    });

    it('stale data triggers FMP fetch and upsert before returning', async () => {
        // fetchedAt older than 24 hours → stale
        const staleDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
        mockGetLatestFetchedAt.mockResolvedValue(staleDate);
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
        mockGetNextForSymbol.mockResolvedValue(nextEarnings);

        const result = await getNextEarningsReport('AAPL', fakeDb);

        expect(result).toEqual(nextEarnings);
        expect(mockGetEarningsReports).toHaveBeenCalledWith('AAPL', 5);
        expect(mockUpsertMany).toHaveBeenCalledTimes(1);
    });

    it('null fetchedAt is treated as stale and triggers FMP fetch', async () => {
        mockGetLatestFetchedAt.mockResolvedValue(null);
        mockGetEarningsReports.mockResolvedValue([]);
        mockGetNextForSymbol.mockResolvedValue(null);

        const result = await getNextEarningsReport('AAPL', fakeDb);

        expect(result).toBeNull();
        expect(mockGetEarningsReports).toHaveBeenCalledWith('AAPL', 5);
    });

    it('FMP failure is swallowed and DB result is still returned', async () => {
        mockGetLatestFetchedAt.mockResolvedValue(null);
        mockGetEarningsReports.mockRejectedValue(new Error('FMP timeout'));
        mockGetNextForSymbol.mockResolvedValue(nextEarnings);

        const result = await getNextEarningsReport('AAPL', fakeDb);

        expect(result).toEqual(nextEarnings);
        expect(mockUpsertMany).not.toHaveBeenCalled();
    });

    it('returns null when DB has no upcoming earnings', async () => {
        mockGetLatestFetchedAt.mockResolvedValue(new Date());
        mockGetNextForSymbol.mockResolvedValue(null);

        const result = await getNextEarningsReport('AAPL', fakeDb);

        expect(result).toBeNull();
    });

    it('passes todayKstIsoDate to getNextForSymbol', async () => {
        mockGetLatestFetchedAt.mockResolvedValue(new Date());
        mockGetNextForSymbol.mockResolvedValue(null);

        await getNextEarningsReport('TSLA', fakeDb);

        expect(mockGetNextForSymbol).toHaveBeenCalledWith('TSLA', '2026-05-25');
    });
});
