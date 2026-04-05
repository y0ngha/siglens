import { FmpProvider } from '@/infrastructure/market/fmp';

const mockFmpBar = {
    date: '2024-01-15 09:30:00',
    open: 100,
    high: 105,
    low: 99,
    close: 103,
    volume: 1000000,
};

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('FmpProvider', () => {
    beforeEach(() => {
        process.env.FMP_API_KEY = 'test-fmp-key';
        mockFetch.mockReset();
    });

    afterEach(() => {
        delete process.env.FMP_API_KEY;
    });

    describe('constructor', () => {
        it('FMP_API_KEY가 없으면 에러를 던진다', () => {
            delete process.env.FMP_API_KEY;
            expect(() => new FmpProvider()).toThrow('FMP_API_KEY must be set');
        });

        it('FMP_API_KEY가 있으면 정상 생성된다', () => {
            expect(() => new FmpProvider()).not.toThrow();
        });
    });

    describe('getBars', () => {
        it('정상 응답을 Bar[] 형태로 변환한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => [mockFmpBar],
            });

            const provider = new FmpProvider();
            const bars = await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Min',
            });

            expect(bars).toHaveLength(1);
            expect(bars[0]).toEqual({
                time: Math.floor(
                    new Date('2024-01-15 09:30:00 UTC').getTime() / 1000
                ),
                open: 100,
                high: 105,
                low: 99,
                close: 103,
                volume: 1000000,
            });
        });

        it('올바른 base URL, timeframe, symbol, apikey를 포함한 URL로 요청한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => [],
            });

            const provider = new FmpProvider();
            await provider.getBars({
                symbol: 'TSLA',
                timeframe: '5Min',
            });

            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain(
                'financialmodelingprep.com/api/v3/historical-chart/5min/TSLA'
            );
            expect(url).toContain('apikey=test-fmp-key');
        });

        it('timeframe이 1Day이면 URL에 1day가 포함된다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => [],
            });

            const provider = new FmpProvider();
            await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
            });

            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain('historical-chart/1day/AAPL');
        });

        it('before 파라미터가 있으면 to 쿼리 파라미터로 YYYY-MM-DD 형식으로 전달한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => [],
            });

            const provider = new FmpProvider();
            await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Min',
                before: '2024-01-15T09:30:00Z',
            });

            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain('to=2024-01-15');
        });

        it('before 파라미터가 없으면 to 쿼리 파라미터를 포함하지 않는다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => [],
            });

            const provider = new FmpProvider();
            await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Min',
            });

            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(new URL(url).searchParams.has('to')).toBe(false);
        });

        it('FMP 응답은 newest-first이므로 reverse하여 ascending order로 반환한다', async () => {
            const newestFirst = [
                { ...mockFmpBar, date: '2024-01-15 09:32:00', close: 103 },
                { ...mockFmpBar, date: '2024-01-15 09:31:00', close: 102 },
                { ...mockFmpBar, date: '2024-01-15 09:30:00', close: 101 },
            ];
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => newestFirst,
            });

            const provider = new FmpProvider();
            const bars = await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Min',
            });

            expect(bars[0].close).toBe(101);
            expect(bars[1].close).toBe(102);
            expect(bars[2].close).toBe(103);
        });

        it('API가 ok가 아닌 응답을 반환하면 에러를 던진다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
            });

            const provider = new FmpProvider();
            await expect(
                provider.getBars({ symbol: 'AAPL', timeframe: '1Min' })
            ).rejects.toThrow('FMP API error: 401 Unauthorized');
        });

        it('빈 응답이면 빈 배열을 반환한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => [],
            });

            const provider = new FmpProvider();
            const bars = await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Min',
            });

            expect(bars).toEqual([]);
        });

        it('date 필드를 UTC로 파싱하여 Unix timestamp로 변환한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => [
                    { ...mockFmpBar, date: '2024-01-15 00:00:00' },
                ],
            });

            const provider = new FmpProvider();
            const bars = await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
            });

            const expectedTime = Math.floor(
                new Date('2024-01-15 00:00:00 UTC').getTime() / 1000
            );
            expect(bars[0].time).toBe(expectedTime);
        });
    });
});
