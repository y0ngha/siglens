import { FmpProvider } from '@/infrastructure/market/fmp';

const mockFmpBar = {
    date: '2024-01-15 09:30:00',
    open: 100,
    high: 105,
    low: 99,
    close: 103,
    volume: 1000000,
};

const mockFmpDailyBar = {
    date: '2024-01-15',
    open: 100,
    high: 105,
    low: 99,
    close: 103,
    volume: 1000000,
};

// 당일 quote 모의 데이터 (timestamp는 2024-01-16 15:00 UTC → 날짜 2024-01-16)
const mockFmpQuote = {
    price: 110,
    open: 105,
    dayHigh: 115,
    dayLow: 104,
    volume: 2000000,
    timestamp: Math.floor(new Date('2024-01-16T15:00:00Z').getTime() / 1000),
};

// 대부분의 테스트에서 quote fetch가 결과에 영향을 주지 않도록 빈 응답을 반환하는 mock
const emptyQuoteMock = { ok: true, json: async () => [] };

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
        describe('intraday 타임프레임', () => {
            it('정상 응답을 Bar[] 형태로 변환한다', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => [mockFmpBar],
                });

                const provider = new FmpProvider();
                const bars = await provider.getBars({
                    symbol: 'AAPL',
                    timeframe: '5Min',
                });

                expect(bars).toHaveLength(1);
                expect(bars[0]).toEqual({
                    // mockFmpBar.date = '2024-01-15 09:30:00' (ET)
                    // January = EST (UTC-5) → UTC = 09:30 + 5h = 14:30 UTC
                    time: Math.floor(
                        new Date('2024-01-15T14:30:00Z').getTime() / 1000
                    ),
                    open: 100,
                    high: 105,
                    low: 99,
                    close: 103,
                    volume: 1000000,
                });
            });

            it('올바른 base URL, timeframe, symbol query param, apikey를 포함한 URL로 요청한다', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => [],
                });

                const provider = new FmpProvider();
                await provider.getBars({
                    symbol: 'TSLA',
                    timeframe: '15Min',
                });

                // jest mock.calls 타입이 unknown[]이므로 tuple 형태로 assertion 필요
                const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
                expect(url).toContain(
                    'financialmodelingprep.com/stable/historical-chart/15min'
                );
                expect(new URL(url).searchParams.get('symbol')).toBe('TSLA');
                expect(url).toContain('apikey=test-fmp-key');
            });

            it('before 파라미터가 있으면 to 쿼리 파라미터로 YYYY-MM-DD 형식으로 전달한다', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => [],
                });

                const provider = new FmpProvider();
                await provider.getBars({
                    symbol: 'AAPL',
                    timeframe: '5Min',
                    before: '2024-01-15T09:30:00Z',
                });

                // jest mock.calls 타입이 unknown[]이므로 tuple 형태로 assertion 필요
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
                    timeframe: '5Min',
                });

                // jest mock.calls 타입이 unknown[]이므로 tuple 형태로 assertion 필요
                const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
                expect(new URL(url).searchParams.has('to')).toBe(false);
            });

            it('from 파라미터가 있으면 from 쿼리 파라미터로 YYYY-MM-DD 형식으로 전달한다', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => [],
                });

                const provider = new FmpProvider();
                await provider.getBars({
                    symbol: 'AAPL',
                    timeframe: '5Min',
                    from: '2024-01-01T00:00:00.000Z',
                });

                // jest mock.calls 타입이 unknown[]이므로 tuple 형태로 assertion 필요
                const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
                expect(new URL(url).searchParams.get('from')).toBe(
                    '2024-01-01'
                );
            });

            it('from 파라미터가 없으면 from 쿼리 파라미터를 포함하지 않는다', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => [],
                });

                const provider = new FmpProvider();
                await provider.getBars({
                    symbol: 'AAPL',
                    timeframe: '5Min',
                });

                // jest mock.calls 타입이 unknown[]이므로 tuple 형태로 assertion 필요
                const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
                expect(new URL(url).searchParams.has('from')).toBe(false);
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
                    timeframe: '5Min',
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
                    provider.getBars({ symbol: 'AAPL', timeframe: '5Min' })
                ).rejects.toThrow('FMP API error: 401 Unauthorized');
            });

            it('API가 배열이 아닌 객체를 반환하면 빈 배열을 반환한다', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ error: 'Invalid ticker' }),
                });

                const provider = new FmpProvider();
                const bars = await provider.getBars({
                    symbol: 'INVALID',
                    timeframe: '5Min',
                });

                expect(bars).toEqual([]);
            });

            it('빈 응답이면 빈 배열을 반환한다', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => [],
                });

                const provider = new FmpProvider();
                const bars = await provider.getBars({
                    symbol: 'AAPL',
                    timeframe: '5Min',
                });

                expect(bars).toEqual([]);
            });

            it('date 필드를 ET 기준으로 파싱하여 UTC Unix timestamp로 변환한다 (EST: UTC-5)', async () => {
                // 2024-01-15 = January = EST (UTC-5)
                // 00:00 ET + 5h = 05:00 UTC
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => [
                        { ...mockFmpBar, date: '2024-01-15 00:00:00' },
                    ],
                });

                const provider = new FmpProvider();
                const bars = await provider.getBars({
                    symbol: 'AAPL',
                    timeframe: '1Hour',
                });

                const expectedTime = Math.floor(
                    new Date('2024-01-15T05:00:00Z').getTime() / 1000
                );
                expect(bars[0].time).toBe(expectedTime);
            });

            it('date 필드를 ET 기준으로 파싱하여 UTC Unix timestamp로 변환한다 (EDT: UTC-4)', async () => {
                // 2024-06-15 = June = EDT (UTC-4)
                // 09:30 ET + 4h = 13:30 UTC
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => [
                        { ...mockFmpBar, date: '2024-06-15 09:30:00' },
                    ],
                });

                const provider = new FmpProvider();
                const bars = await provider.getBars({
                    symbol: 'AAPL',
                    timeframe: '5Min',
                });

                const expectedTime = Math.floor(
                    new Date('2024-06-15T13:30:00Z').getTime() / 1000
                );
                expect(bars[0].time).toBe(expectedTime);
            });
        });

        describe('daily 타임프레임 (1Day)', () => {
            it('historical-price-eod/full 엔드포인트로 요청한다', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => [],
                });
                mockFetch.mockResolvedValueOnce(emptyQuoteMock);

                const provider = new FmpProvider();
                await provider.getBars({
                    symbol: 'AAPL',
                    timeframe: '1Day',
                });

                const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
                expect(url).toContain(
                    'financialmodelingprep.com/stable/historical-price-eod/full'
                );
                expect(new URL(url).searchParams.get('symbol')).toBe('AAPL');
            });

            it('정상 응답을 Bar[] 형태로 변환한다', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => [mockFmpDailyBar],
                });
                mockFetch.mockResolvedValueOnce(emptyQuoteMock);

                const provider = new FmpProvider();
                const bars = await provider.getBars({
                    symbol: 'AAPL',
                    timeframe: '1Day',
                });

                expect(bars).toHaveLength(1);
                expect(bars[0]).toEqual({
                    // 'T00:00:00'을 붙여 local time midnight으로 파싱 (timezone 버그 수정)
                    time: Math.floor(
                        new Date('2024-01-15T00:00:00').getTime() / 1000
                    ),
                    open: 100,
                    high: 105,
                    low: 99,
                    close: 103,
                    volume: 1000000,
                });
            });

            it('FMP daily 응답은 newest-first이므로 reverse하여 ascending order로 반환한다', async () => {
                const newestFirst = [
                    { ...mockFmpDailyBar, date: '2024-01-17', close: 103 },
                    { ...mockFmpDailyBar, date: '2024-01-16', close: 102 },
                    { ...mockFmpDailyBar, date: '2024-01-15', close: 101 },
                ];
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => newestFirst,
                });
                mockFetch.mockResolvedValueOnce(emptyQuoteMock);

                const provider = new FmpProvider();
                const bars = await provider.getBars({
                    symbol: 'AAPL',
                    timeframe: '1Day',
                });

                expect(bars[0].close).toBe(101);
                expect(bars[1].close).toBe(102);
                expect(bars[2].close).toBe(103);
            });

            it('before 파라미터가 있으면 to 쿼리 파라미터로 전달하고 quote를 호출하지 않는다', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => [],
                });

                const provider = new FmpProvider();
                await provider.getBars({
                    symbol: 'AAPL',
                    timeframe: '1Day',
                    before: '2024-01-15T00:00:00Z',
                });

                // before가 있으면 quote fetch를 건너뛰므로 fetch는 1번만 호출된다
                expect(mockFetch).toHaveBeenCalledTimes(1);
                const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
                expect(new URL(url).searchParams.get('to')).toBe('2024-01-15');
            });

            it('from 파라미터가 있으면 from 쿼리 파라미터로 전달한다', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => [],
                });
                mockFetch.mockResolvedValueOnce(emptyQuoteMock);

                const provider = new FmpProvider();
                await provider.getBars({
                    symbol: 'AAPL',
                    timeframe: '1Day',
                    from: '2024-01-01T00:00:00Z',
                });

                const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
                expect(new URL(url).searchParams.get('from')).toBe(
                    '2024-01-01'
                );
            });

            it('API가 ok가 아닌 응답을 반환하면 에러를 던진다', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: false,
                    status: 403,
                    statusText: 'Forbidden',
                });
                // Promise.all로 EOD와 quote를 동시에 요청하므로 quote mock도 필요
                mockFetch.mockResolvedValueOnce(emptyQuoteMock);

                const provider = new FmpProvider();
                await expect(
                    provider.getBars({ symbol: 'AAPL', timeframe: '1Day' })
                ).rejects.toThrow('FMP API error: 403 Forbidden');
            });

            it('API가 배열이 아닌 객체를 반환하면 빈 배열을 반환한다', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ error: 'Invalid ticker' }),
                });
                mockFetch.mockResolvedValueOnce(emptyQuoteMock);

                const provider = new FmpProvider();
                const bars = await provider.getBars({
                    symbol: 'INVALID',
                    timeframe: '1Day',
                });

                expect(bars).toEqual([]);
            });

            it('빈 응답이면 빈 배열을 반환한다', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => [],
                });
                mockFetch.mockResolvedValueOnce(emptyQuoteMock);

                const provider = new FmpProvider();
                const bars = await provider.getBars({
                    symbol: 'AAPL',
                    timeframe: '1Day',
                });

                expect(bars).toEqual([]);
            });

            describe('당일 quote 추가', () => {
                it('마지막 EOD 봉 이후 날짜의 quote를 마지막 봉으로 추가한다', async () => {
                    mockFetch.mockResolvedValueOnce({
                        ok: true,
                        json: async () => [mockFmpDailyBar], // 마지막: 2024-01-15
                    });
                    mockFetch.mockResolvedValueOnce({
                        ok: true,
                        json: async () => [mockFmpQuote], // 당일: 2024-01-16
                    });

                    const provider = new FmpProvider();
                    const bars = await provider.getBars({
                        symbol: 'AAPL',
                        timeframe: '1Day',
                    });

                    expect(bars).toHaveLength(2);
                    expect(bars[1]).toEqual({
                        time: Math.floor(
                            new Date('2024-01-16T00:00:00').getTime() / 1000
                        ),
                        open: mockFmpQuote.open,
                        high: mockFmpQuote.dayHigh,
                        low: mockFmpQuote.dayLow,
                        close: mockFmpQuote.price,
                        volume: mockFmpQuote.volume,
                    });
                });

                it('quote 날짜가 마지막 EOD 봉과 같으면 추가하지 않는다', async () => {
                    // 장 마감 후 EOD가 업데이트된 경우
                    const sameDayQuote = {
                        ...mockFmpQuote,
                        timestamp: Math.floor(
                            new Date('2024-01-15T20:00:00Z').getTime() / 1000
                        ), // 2024-01-15
                    };
                    mockFetch.mockResolvedValueOnce({
                        ok: true,
                        json: async () => [mockFmpDailyBar], // 마지막: 2024-01-15
                    });
                    mockFetch.mockResolvedValueOnce({
                        ok: true,
                        json: async () => [sameDayQuote], // 당일도 2024-01-15
                    });

                    const provider = new FmpProvider();
                    const bars = await provider.getBars({
                        symbol: 'AAPL',
                        timeframe: '1Day',
                    });

                    expect(bars).toHaveLength(1);
                });

                it('quote API가 ok가 아닌 응답을 반환해도 EOD 데이터를 반환한다', async () => {
                    mockFetch.mockResolvedValueOnce({
                        ok: true,
                        json: async () => [mockFmpDailyBar],
                    });
                    mockFetch.mockResolvedValueOnce({
                        ok: false,
                        status: 429,
                        statusText: 'Too Many Requests',
                    });

                    const provider = new FmpProvider();
                    const bars = await provider.getBars({
                        symbol: 'AAPL',
                        timeframe: '1Day',
                    });

                    expect(bars).toHaveLength(1);
                    expect(bars[0].close).toBe(103);
                });

                it('quote API가 배열이 아닌 응답을 반환해도 EOD 데이터를 반환한다', async () => {
                    mockFetch.mockResolvedValueOnce({
                        ok: true,
                        json: async () => [mockFmpDailyBar],
                    });
                    mockFetch.mockResolvedValueOnce({
                        ok: true,
                        json: async () => ({ error: 'Not found' }),
                    });

                    const provider = new FmpProvider();
                    const bars = await provider.getBars({
                        symbol: 'AAPL',
                        timeframe: '1Day',
                    });

                    expect(bars).toHaveLength(1);
                });

                it('quote API가 빈 배열을 반환해도 EOD 데이터를 반환한다', async () => {
                    mockFetch.mockResolvedValueOnce({
                        ok: true,
                        json: async () => [mockFmpDailyBar],
                    });
                    mockFetch.mockResolvedValueOnce(emptyQuoteMock);

                    const provider = new FmpProvider();
                    const bars = await provider.getBars({
                        symbol: 'AAPL',
                        timeframe: '1Day',
                    });

                    expect(bars).toHaveLength(1);
                });

                it('quote fetch가 예외를 던져도 EOD 데이터를 반환한다', async () => {
                    mockFetch.mockResolvedValueOnce({
                        ok: true,
                        json: async () => [mockFmpDailyBar],
                    });
                    mockFetch.mockRejectedValueOnce(new Error('Network error'));

                    const provider = new FmpProvider();
                    const bars = await provider.getBars({
                        symbol: 'AAPL',
                        timeframe: '1Day',
                    });

                    expect(bars).toHaveLength(1);
                });

                it('EOD 데이터가 없고 quote가 유효하면 quote 봉만 반환한다', async () => {
                    mockFetch.mockResolvedValueOnce({
                        ok: true,
                        json: async () => [],
                    });
                    mockFetch.mockResolvedValueOnce({
                        ok: true,
                        json: async () => [mockFmpQuote],
                    });

                    const provider = new FmpProvider();
                    const bars = await provider.getBars({
                        symbol: 'AAPL',
                        timeframe: '1Day',
                    });

                    expect(bars).toHaveLength(1);
                    expect(bars[0].close).toBe(mockFmpQuote.price);
                });

                it('quote URL에 symbol과 apikey를 포함한다', async () => {
                    mockFetch.mockResolvedValueOnce({
                        ok: true,
                        json: async () => [],
                    });
                    mockFetch.mockResolvedValueOnce(emptyQuoteMock);

                    const provider = new FmpProvider();
                    await provider.getBars({
                        symbol: 'TSLA',
                        timeframe: '1Day',
                    });

                    const [quoteUrl] = mockFetch.mock.calls[1] as [
                        string,
                        RequestInit,
                    ];
                    expect(quoteUrl).toContain(
                        'financialmodelingprep.com/stable/quote'
                    );
                    expect(new URL(quoteUrl).searchParams.get('symbol')).toBe(
                        'TSLA'
                    );
                    expect(quoteUrl).toContain('apikey=test-fmp-key');
                });
            });
        });
    });
});
