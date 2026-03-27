import { fetchBarsWithIndicators } from '@/infrastructure/market/barsApi';
import {
    DEFAULT_TIMEFRAME,
    TIMEFRAME_BARS_LIMIT,
} from '@/domain/constants/market';
import {
    MA_DEFAULT_PERIODS,
    EMA_DEFAULT_PERIODS,
} from '@/domain/indicators/constants';

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

describe('fetchBarsWithIndicators 함수는', () => {
    describe('정상 응답일 때', () => {
        it('bars와 indicators를 포함한 BarsData를 반환한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ bars: [mockBar], hasMore: false }),
            });

            const result = await fetchBarsWithIndicators(
                'AAPL',
                DEFAULT_TIMEFRAME
            );

            expect(result.bars).toHaveLength(1);
            expect(result.bars[0]).toEqual(mockBar);
            expect(Array.isArray(result.indicators.rsi)).toBe(true);
            expect(Array.isArray(result.indicators.macd)).toBe(true);
            expect(Array.isArray(result.indicators.bollinger)).toBe(true);
            expect(Array.isArray(result.indicators.dmi)).toBe(true);
            expect(Array.isArray(result.indicators.vwap)).toBe(true);
            expect(Array.isArray(result.indicators.ma)).toBe(false);
            expect(typeof result.indicators.ma).toBe('object');
            MA_DEFAULT_PERIODS.forEach(period => {
                expect(result.indicators.ma).toHaveProperty(String(period));
            });
            expect(Array.isArray(result.indicators.ema)).toBe(false);
            expect(typeof result.indicators.ema).toBe('object');
            EMA_DEFAULT_PERIODS.forEach(period => {
                expect(result.indicators.ema).toHaveProperty(String(period));
            });
        });

        it('symbol과 timeframe으로 올바른 URL을 요청한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ bars: [], hasMore: false }),
            });

            await fetchBarsWithIndicators('TSLA', DEFAULT_TIMEFRAME);

            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain('symbol=TSLA');
            expect(url).toContain('timeframe=1Day');
            expect(url).toContain(
                `limit=${TIMEFRAME_BARS_LIMIT[DEFAULT_TIMEFRAME]}`
            );
        });

        it('symbol을 URL 인코딩하여 요청한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ bars: [], hasMore: false }),
            });

            await fetchBarsWithIndicators('BRK A', DEFAULT_TIMEFRAME);

            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain('symbol=BRK%20A');
        });

        it('signal을 fetch 옵션으로 전달한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ bars: [], hasMore: false }),
            });

            const controller = new AbortController();
            await fetchBarsWithIndicators(
                'AAPL',
                DEFAULT_TIMEFRAME,
                controller.signal
            );

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
                fetchBarsWithIndicators('AAPL', DEFAULT_TIMEFRAME)
            ).rejects.toThrow('데이터를 불러오지 못했습니다 (500)');
        });
    });
});
