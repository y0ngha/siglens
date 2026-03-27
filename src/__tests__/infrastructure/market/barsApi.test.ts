import { fetchBarsWithIndicators } from '@/infrastructure/market/barsApi';
import { TIMEFRAME_BARS_LIMIT } from '@/domain/constants/market';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockBar = {
    time: 1705312200,
    open: 100,
    high: 105,
    low: 99,
    close: 103,
    volume: 1000000,
};

beforeEach(() => {
    mockFetch.mockReset();
});

describe('fetchBarsWithIndicators', () => {
    describe('정상 응답일 때', () => {
        it('bars와 indicators를 포함한 BarsData를 반환한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ bars: [mockBar], hasMore: false }),
            });

            const result = await fetchBarsWithIndicators('AAPL', '1Day');

            expect(result.bars).toHaveLength(1);
            expect(result.bars[0]).toEqual(mockBar);
            expect(result.indicators).toBeDefined();
        });

        it('symbol과 timeframe으로 올바른 URL을 요청한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ bars: [], hasMore: false }),
            });

            await fetchBarsWithIndicators('TSLA', '1Day');

            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain('symbol=TSLA');
            expect(url).toContain('timeframe=1Day');
            expect(url).toContain(
                `limit=${TIMEFRAME_BARS_LIMIT['1Day'].toString()}`
            );
        });

        it('symbol을 URL 인코딩하여 요청한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ bars: [], hasMore: false }),
            });

            await fetchBarsWithIndicators('BRK A', '1Day');

            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain('symbol=BRK%20A');
        });

        it('signal을 fetch 옵션으로 전달한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ bars: [], hasMore: false }),
            });

            const controller = new AbortController();
            await fetchBarsWithIndicators('AAPL', '1Day', controller.signal);

            const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(init.signal).toBe(controller.signal);
        });
    });

    describe('응답이 ok가 아닐 때', () => {
        it('에러를 던진다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
            });

            await expect(
                fetchBarsWithIndicators('AAPL', '1Day')
            ).rejects.toThrow('데이터를 불러오지 못했습니다 (500)');
        });
    });
});
