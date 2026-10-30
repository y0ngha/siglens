const mockFindByUser = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('@/entities/portfolio/api', () => ({
    DrizzlePortfolioRepository: vi.fn().mockImplementation(function () {
        return { findByUser: mockFindByUser };
    }),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn().mockReturnValue({ db: {} }),
}));

import { loadPortfolioHoldings } from '../loadPortfolioHoldings';

function record(symbol: string) {
    return {
        id: `holding-${symbol}`,
        userId: 'user-1',
        symbol,
        companyName: `${symbol} Inc.`,
        fmpSymbol: symbol,
        quantity: '1',
        averagePrice: '10',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };
}

describe('loadPortfolioHoldings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('회원 id로 보유종목을 읽는다', async () => {
        mockFindByUser.mockResolvedValue([]);

        await loadPortfolioHoldings('user-1');

        expect(mockFindByUser).toHaveBeenCalledWith('user-1');
    });

    it('뷰로 바꿔 심볼 오름차순으로 돌려준다', async () => {
        mockFindByUser.mockResolvedValue([record('MSFT'), record('AAPL')]);

        const holdings = await loadPortfolioHoldings('user-1');

        expect(holdings).toEqual([
            {
                symbol: 'AAPL',
                companyName: 'AAPL Inc.',
                fmpSymbol: 'AAPL',
                quantity: '1',
                averagePrice: '10',
                updatedAt: '2026-01-02T00:00:00.000Z',
            },
            {
                symbol: 'MSFT',
                companyName: 'MSFT Inc.',
                fmpSymbol: 'MSFT',
                quantity: '1',
                averagePrice: '10',
                updatedAt: '2026-01-02T00:00:00.000Z',
            },
        ]);
    });

    it('조회가 실패하면 null로 degrade한다', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        mockFindByUser.mockRejectedValue(new Error('transient DB error'));

        await expect(loadPortfolioHoldings('user-1')).resolves.toBeNull();
    });

    it('조회 실패를 삼키지 않고 원인과 함께 로그로 남긴다', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        const cause = new Error('transient DB error');
        mockFindByUser.mockRejectedValue(cause);

        await loadPortfolioHoldings('user-1');

        expect(errorSpy).toHaveBeenCalledWith(
            '[portfolio] holdings load failed',
            cause
        );
    });
});
