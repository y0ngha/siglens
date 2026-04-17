import { AlpacaProvider } from '@/infrastructure/market/alpaca';

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

describe('AlpacaProvider', () => {
    beforeEach(() => {
        process.env.ALPACA_API_KEY = 'test-key';
        process.env.ALPACA_API_SECRET = 'test-secret';
        mockFetch.mockReset();
    });

    afterEach(() => {
        delete process.env.ALPACA_API_KEY;
        delete process.env.ALPACA_API_SECRET;
        delete process.env.ALPACA_SECRET_KEY;
    });

    describe('constructor', () => {
        it('ALPACA_API_KEY가 없으면 에러를 던진다', () => {
            delete process.env.ALPACA_API_KEY;
            expect(() => new AlpacaProvider()).toThrow(
                'ALPACA_API_KEY and (ALPACA_API_SECRET or ALPACA_SECRET_KEY) must be set'
            );
        });

        it('ALPACA_API_SECRET과 ALPACA_SECRET_KEY가 모두 없으면 에러를 던진다', () => {
            delete process.env.ALPACA_API_SECRET;
            expect(() => new AlpacaProvider()).toThrow(
                'ALPACA_API_KEY and (ALPACA_API_SECRET or ALPACA_SECRET_KEY) must be set'
            );
        });

        it('ALPACA_API_SECRET이 없고 ALPACA_SECRET_KEY가 있으면 정상 생성된다', () => {
            delete process.env.ALPACA_API_SECRET;
            process.env.ALPACA_SECRET_KEY = 'legacy-secret';
            expect(() => new AlpacaProvider()).not.toThrow();
        });
    });

    describe('getBars', () => {
        it('정상 응답을 Bar[] 형태로 변환한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    symbol: 'AAPL',
                    bars: [mockBar],
                    next_page_token: null,
                }),
            });

            const provider = new AlpacaProvider();
            const bars = await provider.getBars({
                symbol: 'AAPL',
                timeframe: '5Min',
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

            const provider = new AlpacaProvider();
            await provider.getBars({
                symbol: 'TSLA',
                timeframe: '5Min',
                limit: 100,
            });

            // jest mock.calls 타입이 unknown[]이므로 tuple 형태로 assertion 필요
            const [url, init] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toContain('data.alpaca.markets/v2/stocks/TSLA/bars');
            expect(url).toContain('timeframe=5Min');
            expect(url).toContain('limit=100');
            // RequestInit.headers는 HeadersInit union 타입이므로 Record로 narrowing
            expect(
                (init.headers as Record<string, string>)['APCA-API-KEY-ID']
            ).toBe('test-key');
            expect(
                (init.headers as Record<string, string>)['APCA-API-SECRET-KEY']
            ).toBe('test-secret');
        });

        it('before 파라미터가 없으면 end 쿼리 파라미터를 포함하지 않는다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    symbol: 'AAPL',
                    bars: [],
                    next_page_token: null,
                }),
            });

            const provider = new AlpacaProvider();
            await provider.getBars({ symbol: 'AAPL', timeframe: '5Min' });

            // jest mock.calls 타입이 unknown[]이므로 tuple 형태로 assertion 필요
            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            const endParam = new URL(url).searchParams.get('end');
            expect(endParam).toBeNull();
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

            const provider = new AlpacaProvider();
            await provider.getBars({
                symbol: 'AAPL',
                timeframe: '5Min',
                before: '2024-01-15T09:30:00Z',
            });

            // jest mock.calls 타입이 unknown[]이므로 tuple 형태로 assertion 필요
            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain('end=2024-01-15T09%3A30%3A00Z');
        });

        it('from 파라미터가 없으면 start 쿼리 파라미터를 포함하지 않는다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    symbol: 'AAPL',
                    bars: [],
                    next_page_token: null,
                }),
            });

            const provider = new AlpacaProvider();
            await provider.getBars({ symbol: 'AAPL', timeframe: '1Day' });

            // jest mock.calls 타입이 unknown[]이므로 tuple 형태로 assertion 필요
            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(new URL(url).searchParams.has('start')).toBe(false);
        });

        it('from 파라미터가 있으면 start 쿼리 파라미터로 전달한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    symbol: 'AAPL',
                    bars: [],
                    next_page_token: null,
                }),
            });

            const provider = new AlpacaProvider();
            await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
                from: '2024-01-01T00:00:00.000Z',
            });

            // jest mock.calls 타입이 unknown[]이므로 tuple 형태로 assertion 필요
            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            const startParam = new URL(url).searchParams.get('start');
            expect(startParam).toBe('2024-01-01T00:00:00.000Z');
        });

        it('API가 ok가 아닌 응답을 반환하면 에러를 던진다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 403,
                statusText: 'Forbidden',
            });

            const provider = new AlpacaProvider();
            await expect(
                provider.getBars({ symbol: 'AAPL', timeframe: '5Min' })
            ).rejects.toThrow('Alpaca API error: 403 Forbidden');
        });

        it('ALPACA_API_SECRET이 없고 ALPACA_SECRET_KEY가 있으면 legacy-secret으로 요청한다', async () => {
            delete process.env.ALPACA_API_SECRET;
            process.env.ALPACA_SECRET_KEY = 'legacy-secret';
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ bars: [], next_page_token: null }),
            });

            const provider = new AlpacaProvider();
            await provider.getBars({ symbol: 'AAPL', timeframe: '5Min' });
            const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(
                (init.headers as Record<string, string>)['APCA-API-SECRET-KEY']
            ).toBe('legacy-secret');
        });

        it('bars가 없는 응답에도 빈 배열을 반환한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ symbol: 'AAPL', next_page_token: null }),
            });

            const provider = new AlpacaProvider();
            const bars = await provider.getBars({
                symbol: 'AAPL',
                timeframe: '5Min',
            });

            expect(bars).toEqual([]);
        });
    });
});
