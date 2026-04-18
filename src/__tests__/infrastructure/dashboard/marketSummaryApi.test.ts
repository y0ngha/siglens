jest.mock('@/infrastructure/market/factory');

import { getMarketSummary } from '@/infrastructure/dashboard/marketSummaryApi';
import { createMarketDataProvider } from '@/infrastructure/market/factory';
import {
    MARKET_INDICES,
    SECTOR_ETFS,
} from '@/domain/constants/dashboard-tickers';
import type { MarketQuote } from '@/domain/types';

const mockGetQuote = jest.fn();
const mockCreateMarketDataProvider =
    createMarketDataProvider as jest.MockedFunction<
        typeof createMarketDataProvider
    >;

describe('getMarketSummary 함수는', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCreateMarketDataProvider.mockReturnValue({
            getBars: jest.fn(),
            getQuote: mockGetQuote,
        });
    });

    describe('모든 심볼 조회가 성공할 때', () => {
        it('indices와 sectors 배열을 올바르게 반환한다', async () => {
            mockGetQuote.mockImplementation(
                (symbol: string): Promise<MarketQuote | null> => {
                    const price = symbol.startsWith('^') ? 100 : 200;
                    return Promise.resolve({
                        symbol,
                        price,
                        changesPercentage: 1.5,
                        name: symbol,
                    });
                }
            );

            const result = await getMarketSummary();

            expect(result.indices).toHaveLength(MARKET_INDICES.length);
            expect(result.sectors).toHaveLength(SECTOR_ETFS.length);
        });

        it('지수 데이터를 정확히 매핑한다', async () => {
            mockGetQuote.mockResolvedValue({
                symbol: '^GSPC',
                price: 5200.5,
                changesPercentage: 0.45,
                name: 'S&P 500',
            } as MarketQuote);

            const result = await getMarketSummary();
            const sp500 = result.indices.find(i => i.symbol === 'GSPC');

            expect(sp500).toBeDefined();
            expect(sp500?.price).toBe(5200.5);
            expect(sp500?.changesPercentage).toBe(0.45);
            expect(sp500?.displayName).toBe('S&P 500');
            expect(sp500?.koreanName).toBe('미국 대형주 500');
        });

        it('섹터 데이터를 정확히 매핑한다', async () => {
            mockGetQuote.mockResolvedValue({
                symbol: 'XLK',
                price: 210.0,
                changesPercentage: 1.2,
                name: 'Technology',
            } as MarketQuote);

            const result = await getMarketSummary();
            const xlk = result.sectors.find(s => s.symbol === 'XLK');

            expect(xlk).toBeDefined();
            expect(xlk?.price).toBe(210.0);
            expect(xlk?.changesPercentage).toBe(1.2);
            expect(xlk?.sectorName).toBe('Technology');
            expect(xlk?.koreanName).toBe('기술');
        });
    });

    describe('일부 조회가 null을 반환할 때', () => {
        it('null 심볼은 price=0, changesPercentage=0으로 폴백하지 않는다', async () => {
            mockGetQuote.mockResolvedValue(null);

            const result = await getMarketSummary();

            // null 결과는 quoteMap에 포함되지 않아 폴백 값이 사용된다
            result.indices.forEach(idx => {
                expect(idx.price).toBe(0);
                expect(idx.changesPercentage).toBe(0);
            });
            result.sectors.forEach(sec => {
                expect(sec.price).toBe(0);
                expect(sec.changesPercentage).toBe(0);
            });
        });
    });

    describe('모든 심볼에 대해 getQuote를 호출할 때', () => {
        it('MARKET_INDICES와 SECTOR_ETFS의 모든 심볼에 대해 getQuote를 호출한다', async () => {
            mockGetQuote.mockResolvedValue(null);

            await getMarketSummary();

            const expectedCount = MARKET_INDICES.length + SECTOR_ETFS.length;
            expect(mockGetQuote).toHaveBeenCalledTimes(expectedCount);
        });
    });
});
