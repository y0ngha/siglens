import { getBars } from '@/infrastructure/market/alpaca';

const mockBar = {
    t: '2024-01-15T09:30:00Z',
    o: 100,
    h: 105,
    l: 99,
    c: 103,
    v: 1000000,
};

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
    process.env.ALPACA_API_KEY = 'test-key';
    process.env.ALPACA_API_SECRET = 'test-secret';
    mockFetch.mockReset();
});

afterEach(() => {
    delete process.env.ALPACA_API_KEY;
    delete process.env.ALPACA_API_SECRET;
});

describe('alpaca', () => {
    describe('getBars', () => {
        it('ALPACA_API_KEY가 없으면 에러를 던진다', async () => {
            delete process.env.ALPACA_API_KEY;
            await expect(
                getBars({ symbol: 'AAPL', timeframe: '1Min' })
            ).rejects.toThrow(
                'ALPACA_API_KEY and ALPACA_API_SECRET must be set'
            );
        });

        it('ALPACA_API_SECRET이 없으면 에러를 던진다', async () => {
            delete process.env.ALPACA_API_SECRET;
            await expect(
                getBars({ symbol: 'AAPL', timeframe: '1Min' })
            ).rejects.toThrow(
                'ALPACA_API_KEY and ALPACA_API_SECRET must be set'
            );
        });

        it('정상 응답을 Bar[] 형태로 변환한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    symbol: 'AAPL',
                    bars: [mockBar],
                    next_page_token: null,
                }),
            });

            const bars = await getBars({
                symbol: 'AAPL',
                timeframe: '1Min',
            });

            expect(bars).toHaveLength(1);
            expect(bars[0]).toEqual({
                time: Math.floor(
                    new Date('2024-01-15T09:30:00Z').getTime() / 1000
                ),
                open: 100,
                high: 105,
                low: 99,
                close: 103,
                volume: 1000000,
            });
        });

        it('올바른 URL과 인증 헤더로 요청한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    symbol: 'TSLA',
                    bars: [],
                    next_page_token: null,
                }),
            });

            await getBars({
                symbol: 'TSLA',
                timeframe: '5Min',
                limit: 100,
            });

            const [url, init] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toContain('data.alpaca.markets/v2/stocks/TSLA/bars');
            expect(url).toContain('timeframe=5Min');
            expect(url).toContain('limit=100');
            expect(
                (init.headers as Record<string, string>)['APCA-API-KEY-ID']
            ).toBe('test-key');
            expect(
                (init.headers as Record<string, string>)['APCA-API-SECRET-KEY']
            ).toBe('test-secret');
        });

        it('before 파라미터가 없으면 now 인자를 end로 사용한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    symbol: 'AAPL',
                    bars: [],
                    next_page_token: null,
                }),
            });

            const fixedNow = '2024-06-01T12:00:00.000Z';
            await getBars({ symbol: 'AAPL', timeframe: '1Min' }, fixedNow);

            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            const endParam = new URL(url).searchParams.get('end');
            expect(endParam).toBe(fixedNow);
        });

        it('before 파라미터가 있으면 end 쿼리로 전달한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    symbol: 'AAPL',
                    bars: [],
                    next_page_token: null,
                }),
            });

            await getBars({
                symbol: 'AAPL',
                timeframe: '1Min',
                before: '2024-01-15T09:30:00Z',
            });

            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain('end=2024-01-15T09%3A30%3A00Z');
        });

        it('start 파라미터를 포함하지 않는다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    symbol: 'AAPL',
                    bars: [],
                    next_page_token: null,
                }),
            });

            await getBars({ symbol: 'AAPL', timeframe: '1Day' });

            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(new URL(url).searchParams.has('start')).toBe(false);
        });

        it('API가 ok가 아닌 응답을 반환하면 에러를 던진다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 403,
                statusText: 'Forbidden',
            });

            await expect(
                getBars({ symbol: 'AAPL', timeframe: '1Min' })
            ).rejects.toThrow('Alpaca API error: 403 Forbidden');
        });

        it('bars가 없는 응답에도 빈 배열을 반환한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ symbol: 'AAPL', nextPageToken: null }),
            });

            const bars = await getBars({
                symbol: 'AAPL',
                timeframe: '1Min',
            });

            expect(bars).toEqual([]);
        });
    });
});
