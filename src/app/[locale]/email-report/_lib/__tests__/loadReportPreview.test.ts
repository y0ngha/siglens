const mockFindHoldings = vi.fn();
const mockFindWatchlist = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('@/entities/portfolio/api', () => ({
    DrizzlePortfolioRepository: vi.fn().mockImplementation(function () {
        return { findByUser: mockFindHoldings };
    }),
}));
vi.mock('@/entities/watchlist/api', () => ({
    DrizzleWatchlistRepository: vi.fn().mockImplementation(function () {
        return { findByUser: mockFindWatchlist };
    }),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn().mockReturnValue({ db: {} }),
}));

import { loadReportPreview } from '@/app/[locale]/email-report/_lib/loadReportPreview';

describe('loadReportPreview', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFindHoldings.mockResolvedValue([]);
        mockFindWatchlist.mockResolvedValue([]);
    });

    it('보유·관심종목을 읽어 상세 그룹에 이름 칩을 담는다', async () => {
        mockFindHoldings.mockResolvedValue([
            {
                symbol: 'AAPL',
                companyName: 'Apple',
                quantity: '1',
                averagePrice: '100',
            },
        ]);
        mockFindWatchlist.mockResolvedValue([
            {
                symbol: 'TSLA',
                companyName: 'Tesla',
                createdAt: new Date('2026-10-08T00:00:00Z'),
            },
        ]);

        const preview = await loadReportPreview('u-1');

        expect(mockFindHoldings).toHaveBeenCalledWith('u-1');
        expect(mockFindWatchlist).toHaveBeenCalledWith('u-1');
        expect(preview?.full).toEqual(
            expect.arrayContaining([
                { symbol: 'AAPL', name: 'Apple' },
                { symbol: 'TSLA', name: 'Tesla' },
            ])
        );
    });

    it('이름이 null인 행이 다른 쪽의 알려진 이름을 덮지 않는다', async () => {
        mockFindHoldings.mockResolvedValue([
            {
                symbol: 'AAPL',
                companyName: null,
                quantity: '1',
                averagePrice: '100',
            },
        ]);
        mockFindWatchlist.mockResolvedValue([
            {
                symbol: 'AAPL',
                companyName: 'Apple',
                createdAt: new Date('2026-10-08T00:00:00Z'),
            },
        ]);

        const preview = await loadReportPreview('u-1');

        expect(preview?.full).toEqual([{ symbol: 'AAPL', name: 'Apple' }]);
    });

    it('종목 조회가 실패하면 로그를 남기고 null로 degrade한다', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockFindWatchlist.mockRejectedValue(new Error('db down'));

        expect(await loadReportPreview('u-1')).toBeNull();
        expect(error).toHaveBeenCalled();
    });
});
