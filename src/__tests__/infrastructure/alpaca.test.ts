import { AlpacaProvider } from '@/infrastructure/market/alpaca';
import { TIMEFRAME_LOOKBACK_DAYS } from '@/domain/constants/market';

const LOOKBACK_1MIN_MS = TIMEFRAME_LOOKBACK_DAYS['1Min'] * 24 * 60 * 60 * 1000;

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
    process.env.ALPACA_SECRET_KEY = 'test-secret';
    mockFetch.mockReset();
});

afterEach(() => {
    delete process.env.ALPACA_API_KEY;
    delete process.env.ALPACA_SECRET_KEY;
});

describe('AlpacaProvider', () => {
    describe('constructor', () => {
        it('환경변수가 없으면 에러를 던진다', () => {
            delete process.env.ALPACA_API_KEY;
            expect(() => new AlpacaProvider()).toThrow(
                'ALPACA_API_KEY and ALPACA_SECRET_KEY must be set'
            );
        });
    });

    describe('getBars', () => {
        it('정상 응답을 Bar[] 형태로 변환한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ bars: [mockBar], next_page_token: null }),
            });

            const provider = new AlpacaProvider();
            const bars = await provider.getBars({
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
                json: async () => ({ bars: [], next_page_token: null }),
            });

            const provider = new AlpacaProvider();
            await provider.getBars({
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

        it('before 파라미터가 있으면 end 쿼리로 전달한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ bars: [], next_page_token: null }),
            });

            const provider = new AlpacaProvider();
            await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Min',
                before: '2024-01-15T09:30:00Z',
            });

            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain('end=2024-01-15T09%3A30%3A00Z');
        });

        it('API가 ok가 아닌 응답을 반환하면 에러를 던진다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 403,
                statusText: 'Forbidden',
            });

            const provider = new AlpacaProvider();
            await expect(
                provider.getBars({ symbol: 'AAPL', timeframe: '1Min' })
            ).rejects.toThrow('Alpaca API error: 403 Forbidden');
        });

        it('EST 기간(UTC-5)에 start 파라미터를 올바른 오프셋으로 계산한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ bars: [], next_page_token: null }),
            });

            const provider = new AlpacaProvider();
            // 2024-01-15 (EST, UTC-5) 기준 before
            await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Min',
                before: '2024-01-15T20:00:00Z',
            });

            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain('start=');
            const startParam = new URL(url).searchParams.get('start');
            expect(startParam).not.toBeNull();
            // EST(UTC-5) 기간이므로 start와 end 오프셋이 동일 → endOffsetMs - startOffsetMs = 0
            // lookback 5일(1Min), start = endTime - lookbackMs (offset cancels out)
            const expectedStart = new Date(
                new Date('2024-01-15T20:00:00Z').getTime() - LOOKBACK_1MIN_MS
            ).toISOString();
            expect(startParam).toBe(expectedStart);
        });

        it('EDT 기간(UTC-4)에 start 파라미터를 올바른 오프셋으로 계산한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ bars: [], next_page_token: null }),
            });

            const provider = new AlpacaProvider();
            // 2024-06-15 (EDT, UTC-4) 기준 before
            await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Min',
                before: '2024-06-15T20:00:00Z',
            });

            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            const startParam = new URL(url).searchParams.get('start');
            expect(startParam).not.toBeNull();
            // EDT(UTC-4) 기간이므로 start와 end 오프셋이 동일 → offset 차이 = 0
            const expectedStart = new Date(
                new Date('2024-06-15T20:00:00Z').getTime() - LOOKBACK_1MIN_MS
            ).toISOString();
            expect(startParam).toBe(expectedStart);
        });

        it('DST 전환 경계(EST→EDT)에 걸친 lookback은 오프셋 차이를 반영한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ bars: [], next_page_token: null }),
            });

            const provider = new AlpacaProvider();
            // end: 2024-03-12T10:00:00Z (EDT, UTC-4)
            // lookback 5일(1Min) → approxStart: 2024-03-07T10:00:00Z (EST, UTC-5)
            // endOffset = -4h, startOffset = -5h → 차이 = +1h
            // startUtc = endTime + endOffsetMs - lookbackMs - startOffsetMs
            //          = endTime + (-4h) - 5d - (-5h) = endTime - 5d + 1h
            await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Min',
                before: '2024-03-12T10:00:00Z',
            });

            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            const startParam = new URL(url).searchParams.get('start');
            expect(startParam).not.toBeNull();
            const endMs = new Date('2024-03-12T10:00:00Z').getTime();
            const lookbackMs = LOOKBACK_1MIN_MS;
            const endOffsetMs = -4 * 3600 * 1000;
            const startOffsetMs = -5 * 3600 * 1000;
            const expectedStartMs =
                endMs + endOffsetMs - lookbackMs - startOffsetMs;
            expect(startParam).toBe(new Date(expectedStartMs).toISOString());
        });
    });
});
