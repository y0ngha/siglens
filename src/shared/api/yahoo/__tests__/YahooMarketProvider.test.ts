import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const chart = vi.fn();
const quote = vi.fn();

vi.mock('yahoo-finance2', () => ({
    default: class {
        chart = chart;
        quote = quote;
    },
}));

const { YahooMarketProvider } = await import('../YahooMarketProvider');

/** 2026-08-14 09:00 KST = 2026-08-14T00:00:00Z */
const KST_OPEN = new Date('2026-08-14T00:00:00Z');
const UTC_MIDNIGHT_AUG14 = Math.floor(
    Date.parse('2026-08-14T00:00:00Z') / 1000
);

function bar(overrides: Record<string, unknown> = {}) {
    return {
        date: KST_OPEN,
        open: 275000,
        high: 275500,
        low: 266000,
        close: 274500,
        volume: 21669476,
        ...overrides,
    };
}

describe('YahooMarketProvider', () => {
    beforeEach(() => {
        chart.mockReset();
        quote.mockReset();
    });

    describe('getBars', () => {
        it('maps yahoo quotes to Bar with epoch-second times', async () => {
            chart.mockResolvedValue({ quotes: [bar()] });

            const bars = await new YahooMarketProvider().getBars({
                symbol: '005930.KS',
                timeframe: '1Day',
                from: '2026-08-01T00:00:00Z',
            });

            expect(bars).toEqual([
                {
                    time: UTC_MIDNIGHT_AUG14,
                    open: 275000,
                    high: 275500,
                    low: 266000,
                    close: 274500,
                    volume: 21669476,
                },
            ]);
        });

        it('[1Week 집계 전제] KRX 일봉(09:00 KST 시가 시각)은 time % 86400 === 0 (UTC 자정)', async () => {
            // core가 주봉을 일봉에서 집계할 때 ISO 주 버킷은 UTC 자정 시각에 의존한다(§3.2).
            // yahoo 과거 일봉은 yahoo 자체 시각을 그대로 쓰므로(`toBar`) 어긋나면 주 경계가 밀린다.
            chart.mockResolvedValue({
                quotes: [
                    bar({ date: new Date('2026-08-10T00:00:00Z') }),
                    bar({ date: new Date('2026-08-11T00:00:00Z') }),
                    bar({ date: new Date('2026-08-14T00:00:00Z') }),
                ],
            });

            const bars = await new YahooMarketProvider().getBars({
                symbol: '005930.KS',
                timeframe: '1Day',
                from: '2026-08-01T00:00:00Z',
            });

            expect(bars).toHaveLength(3);
            const SECONDS_PER_DAY = 86_400;
            expect(bars.map(b => b.time % SECONDS_PER_DAY)).toEqual([0, 0, 0]);
        });

        it('drops bars with null OHLC', async () => {
            // 실측(2026-08-16, 005930.KS): 15분봉 405개 중 2개, 일봉 484개 중 1개가
            // close=null이었다. 통과시키면 core 지표 계산이 NaN으로 오염된다.
            chart.mockResolvedValue({
                quotes: [
                    bar(),
                    bar({ close: null }),
                    bar({ open: null }),
                    bar({ high: null }),
                    bar({ low: null }),
                ],
            });

            const bars = await new YahooMarketProvider().getBars({
                symbol: '005930.KS',
                timeframe: '1Day',
            });

            expect(bars).toHaveLength(1);
        });

        describe('종가가 고저 밖인 봉 정규화', () => {
            /**
             * 리플레이 세트 v1(2026-11-21 수집)에서 관측된 14개 봉의 원본 값이다. yahoo `chart`
             * 응답의 quote 모양(`date: Date`, `adjclose` 동반)으로 만들어 실제 매퍼를 통과시킨다.
             * 005930.KS 2024-10-14는 같은 날 yahoo를 직접 조회해도 close(59300) < low(59400)이고
             * adjclose(56492.99)와도 달라, 수정주가 혼용이 아님을 확인했다.
             */
            const OBSERVED: ReadonlyArray<
                readonly [string, number, number, number, number, number]
            > = [
                ['2023-02-02', 94900, 94900, 92700, 91400, 8254],
                ['2023-02-09', 94800, 94800, 92600, 94900, 12117],
                ['2024-10-14', 186900, 192300, 186900, 186000, 3309274],
                ['2023-02-01', 169200, 171500, 168700, 167000, 3251],
                ['2024-01-15', 186000, 187200, 185800, 187500, 35456],
                ['2024-10-14', 59500, 61200, 59400, 59300, 20886249],
                ['2023-02-02', 213000, 213500, 210500, 205500, 20981],
                ['2024-10-14', 350000, 351000, 342500, 354500, 283883],
                ['2024-11-07', 300000, 305000, 294000, 305500, 365149],
                [
                    '2024-10-14',
                    83431.375,
                    84117.6484375,
                    82352.9375,
                    85196.078125,
                    907600,
                ],
                ['2024-01-15', 51000, 51200, 50900, 51600, 83004],
                ['2024-10-14', 92500, 98500, 92000, 91300, 2152870],
                [
                    '2023-02-10',
                    1243866.625,
                    1246941.625,
                    1233103.875,
                    1251554.25,
                    164,
                ],
                [
                    '2024-01-15',
                    1140851.625,
                    1163914.75,
                    1136239,
                    1174677.5,
                    3956,
                ],
            ];

            const toYahooQuote = ([
                date,
                open,
                high,
                low,
                close,
                volume,
            ]: (typeof OBSERVED)[number]) => ({
                date: new Date(`${date}T00:00:00Z`),
                open,
                high,
                low,
                close,
                volume,
                adjclose: close * 0.95,
            });

            const silenceWarn = () =>
                vi.spyOn(console, 'warn').mockImplementation(() => {});

            afterEach(() => {
                vi.restoreAllMocks();
            });

            it('관측된 14개 봉이 모두 L ≤ min(O,C) ≤ max(O,C) ≤ H를 만족한다', async () => {
                silenceWarn();
                chart.mockResolvedValue({
                    quotes: OBSERVED.map(toYahooQuote),
                });

                const bars = await new YahooMarketProvider().getBars({
                    symbol: '005930.KS',
                    timeframe: '1Day',
                });

                expect(bars).toHaveLength(OBSERVED.length);
                bars.forEach(b => {
                    expect(b.low).toBeLessThanOrEqual(
                        Math.min(b.open, b.close)
                    );
                    expect(b.high).toBeGreaterThanOrEqual(
                        Math.max(b.open, b.close)
                    );
                });
            });

            it('종가가 저가 아래면 저가를, 고가 위면 고가를 종가로 넓히고 시가·종가·거래량은 그대로 둔다', async () => {
                silenceWarn();
                chart.mockResolvedValue({
                    quotes: [
                        toYahooQuote(OBSERVED[5]),
                        toYahooQuote(OBSERVED[7]),
                    ],
                });

                const bars = await new YahooMarketProvider().getBars({
                    symbol: '005930.KS',
                    timeframe: '1Day',
                });

                expect(bars).toEqual([
                    {
                        time: Math.floor(
                            Date.parse('2024-10-14T00:00:00Z') / 1000
                        ),
                        open: 59500,
                        high: 61200,
                        low: 59300,
                        close: 59300,
                        volume: 20886249,
                    },
                    {
                        time: Math.floor(
                            Date.parse('2024-10-14T00:00:00Z') / 1000
                        ),
                        open: 350000,
                        high: 354500,
                        low: 342500,
                        close: 354500,
                        volume: 283883,
                    },
                ]);
            });

            it('이미 일관된 봉은 값이 바뀌지 않고 로그도 남기지 않는다', async () => {
                const warnSpy = silenceWarn();
                chart.mockResolvedValue({ quotes: [bar()] });

                const bars = await new YahooMarketProvider().getBars({
                    symbol: '005930.KS',
                    timeframe: '1Day',
                });

                expect(bars[0]).toMatchObject({ high: 275500, low: 266000 });
                expect(warnSpy).not.toHaveBeenCalled();
            });

            it('고친 봉 수를 호출당 한 줄로 남긴다', async () => {
                const warnSpy = silenceWarn();
                chart.mockResolvedValue({
                    quotes: [bar(), ...OBSERVED.map(toYahooQuote)],
                });

                await new YahooMarketProvider().getBars({
                    symbol: '005930.KS',
                    timeframe: '1Day',
                });

                const lines = warnSpy.mock.calls
                    .map(args => String(args[0]))
                    .filter(line => line.includes('ohlc-normalized'));
                expect(lines).toEqual([
                    '[YahooMarketProvider] ohlc-normalized symbol=005930.KS timeframe=1Day fixed=14 total=15',
                ]);
            });
        });

        it('keeps bars whose only null is volume, coercing it to 0', async () => {
            chart.mockResolvedValue({ quotes: [bar({ volume: null })] });

            const bars = await new YahooMarketProvider().getBars({
                symbol: '005930.KS',
                timeframe: '1Day',
            });

            expect(bars).toHaveLength(1);
            expect(bars[0]!.volume).toBe(0);
        });

        it.each([
            ['5Min', '5m'],
            ['15Min', '15m'],
            ['30Min', '30m'],
            ['1Hour', '1h'],
            ['1Day', '1d'],
        ] as const)('maps timeframe %s → interval %s', async (tf, interval) => {
            chart.mockResolvedValue({ quotes: [] });

            await new YahooMarketProvider().getBars({
                symbol: '005930.KS',
                timeframe: tf,
                from: '2026-08-01T00:00:00Z',
            });

            expect(chart).toHaveBeenCalledWith(
                '005930.KS',
                expect.objectContaining({ interval })
            );
        });

        it('returns empty for 4Hour instead of calling yahoo', async () => {
            // yahoo chart의 interval enum에 4h가 없다. descriptor에서도 제외했지만
            // core ProviderTimeframe 타입은 여전히 4Hour를 포함하므로 방어한다.
            const bars = await new YahooMarketProvider().getBars({
                symbol: '005930.KS',
                timeframe: '4Hour',
            });

            expect(bars).toEqual([]);
            expect(chart).not.toHaveBeenCalled();
        });

        it('forwards `before` as period2 and omits it when absent', async () => {
            chart.mockResolvedValue({ quotes: [] });
            const provider = new YahooMarketProvider();

            await provider.getBars({
                symbol: '005930.KS',
                timeframe: '1Day',
                from: '2026-08-01T00:00:00Z',
                before: '2026-08-10',
            });
            expect(chart.mock.calls[0]![1]).toMatchObject({
                period1: '2026-08-01T00:00:00Z',
                period2: '2026-08-10',
            });

            await provider.getBars({
                symbol: '005930.KS',
                timeframe: '1Day',
                from: '2026-08-01T00:00:00Z',
            });
            expect(chart.mock.calls[1]![1]).not.toHaveProperty('period2');
        });

        it('propagates chart failures so callers do not cache an empty result', async () => {
            chart.mockRejectedValue(
                new Error('No data found, symbol may be delisted')
            );

            await expect(
                new YahooMarketProvider().getBars({
                    symbol: '999999.KS',
                    timeframe: '1Day',
                })
            ).rejects.toThrow('No data found');
        });
    });

    describe('getQuoteOrThrow', () => {
        it('rejects (does not swallow) on yahoo fetch failure', async () => {
            // getQuoteOrThrow의 존재 이유는 인프라 실패를 삼키지 않는 것이다 —
            // getQuote는 이 메서드를 try/catch로 감싸 null로 접으므로, 이 메서드
            // 자체가 조용히 null로 수렴하면 getQuote 쪽 테스트만으론 못 잡는다.
            quote.mockRejectedValue(new Error('network'));
            await expect(
                new YahooMarketProvider().getQuoteOrThrow('005930.KS')
            ).rejects.toThrow('network');
        });

        it('resolves null when yahoo returns undefined for an unlisted symbol', async () => {
            quote.mockResolvedValue(undefined);
            expect(
                await new YahooMarketProvider().getQuoteOrThrow('999999.KS')
            ).toBeNull();
        });
    });

    describe('getListingOrThrow', () => {
        it('이름·quoteType·마지막 거래 시각을 quote 한 번으로 돌려준다', async () => {
            const lastTrade = new Date('2024-07-19T06:30:00Z');
            quote.mockResolvedValue({
                regularMarketPrice: 40100,
                longName: 'Studio Dragon Corporation',
                quoteType: 'MUTUALFUND',
                regularMarketTime: lastTrade,
            });
            expect(
                await new YahooMarketProvider().getListingOrThrow('253450.KS')
            ).toEqual({
                name: 'Studio Dragon Corporation',
                quoteType: 'MUTUALFUND',
                lastTradeMs: lastTrade.getTime(),
            });
            expect(quote).toHaveBeenCalledTimes(1);
        });

        it('시세가 없으면 null, 인프라 실패는 던진다', async () => {
            quote.mockResolvedValueOnce(undefined);
            expect(
                await new YahooMarketProvider().getListingOrThrow('999999.KS')
            ).toBeNull();
            quote.mockRejectedValueOnce(new Error('network'));
            await expect(
                new YahooMarketProvider().getListingOrThrow('005930.KS')
            ).rejects.toThrow('network');
        });
    });

    describe('getQuoteTypeOrThrow', () => {
        it('returns the raw yahoo quoteType', async () => {
            quote.mockResolvedValue({
                regularMarketPrice: 40125,
                quoteType: 'ETF',
            });
            expect(
                await new YahooMarketProvider().getQuoteTypeOrThrow('360750.KS')
            ).toBe('ETF');
        });

        it('resolves null when the symbol has no quote', async () => {
            quote.mockResolvedValue(undefined);
            expect(
                await new YahooMarketProvider().getQuoteTypeOrThrow('999999.KS')
            ).toBeNull();
        });

        it('resolves null when quoteType is missing', async () => {
            quote.mockResolvedValue({ regularMarketPrice: 1 });
            expect(
                await new YahooMarketProvider().getQuoteTypeOrThrow('005930.KS')
            ).toBeNull();
        });

        it('rejects on yahoo fetch failure', async () => {
            quote.mockRejectedValue(new Error('network'));
            await expect(
                new YahooMarketProvider().getQuoteTypeOrThrow('005930.KS')
            ).rejects.toThrow('network');
        });
    });

    describe('getQuote', () => {
        it('maps a yahoo quote to MarketQuote', async () => {
            quote.mockResolvedValue({
                regularMarketPrice: 274500,
                regularMarketChangePercent: 2.425373,
                longName: 'Samsung Electronics Co., Ltd.',
                shortName: 'SamsungElec',
            });

            expect(
                await new YahooMarketProvider().getQuote('005930.KS')
            ).toEqual({
                symbol: '005930.KS',
                price: 274500,
                changesPercentage: 2.425373,
                name: 'Samsung Electronics Co., Ltd.',
            });
        });

        it('maps regularMarketTime to core MarketQuote.timestamp in unix seconds', async () => {
            quote.mockResolvedValue({
                regularMarketPrice: 274500,
                regularMarketChangePercent: 2.425373,
                longName: 'Samsung Electronics Co., Ltd.',
                shortName: 'SamsungElec',
                regularMarketTime: new Date('2026-08-14T06:30:24.000Z'),
            });

            const q = await new YahooMarketProvider().getQuote('005930.KS');
            expect(q).toMatchObject({ timestamp: 1786689024 });
        });

        it('regularMarketTime이 없으면 timestamp 필드를 싣지 않는다', async () => {
            quote.mockResolvedValue({
                regularMarketPrice: 274500,
                regularMarketChangePercent: 2.425373,
                longName: 'Samsung Electronics Co., Ltd.',
                shortName: 'SamsungElec',
            });

            const q = await new YahooMarketProvider().getQuote('005930.KS');
            expect(q).not.toHaveProperty('timestamp');
        });

        it('returns null when yahoo returns undefined for an unlisted symbol', async () => {
            // 실측: yahoo는 미상장 심볼에 throw가 아니라 undefined를 반환한다.
            quote.mockResolvedValue(undefined);
            expect(
                await new YahooMarketProvider().getQuote('999999.KS')
            ).toBeNull();
        });

        it('degrades to null on fetch failure', async () => {
            quote.mockRejectedValue(new Error('network'));
            expect(
                await new YahooMarketProvider().getQuote('005930.KS')
            ).toBeNull();
        });
    });

    describe('getTodayBar', () => {
        it('stamps the bar at UTC midnight of the KST trading date', async () => {
            quote.mockResolvedValue({
                regularMarketPrice: 274500,
                regularMarketOpen: 275000,
                regularMarketDayHigh: 275500,
                regularMarketDayLow: 266000,
                regularMarketVolume: 21669476,
                // 15:30 KST 마감 시각 — UTC로는 같은 날 06:30.
                regularMarketTime: new Date('2026-08-14T06:30:24.000Z'),
            });

            expect(
                await new YahooMarketProvider().getTodayBar('005930.KS')
            ).toEqual({
                time: UTC_MIDNIGHT_AUG14,
                open: 275000,
                high: 275500,
                low: 266000,
                close: 274500,
                volume: 21669476,
            });
        });

        it('keeps the KST date when the quote timestamp falls in the previous UTC day', async () => {
            // 22:00 KST(=13:00 UTC 같은 날)처럼 정규장 밖 타임스탬프가 와도 KST 날짜를 쓴다.
            quote.mockResolvedValue({
                regularMarketPrice: 274500,
                regularMarketTime: new Date('2026-08-13T16:00:00.000Z'), // 2026-08-14 01:00 KST
            });

            const bar = await new YahooMarketProvider().getTodayBar(
                '005930.KS'
            );
            expect(bar!.time).toBe(UTC_MIDNIGHT_AUG14);
        });

        it('falls back to close for missing OHL so the bar is not flattened to 0', async () => {
            quote.mockResolvedValue({
                regularMarketPrice: 274500,
                regularMarketTime: new Date('2026-08-14T00:00:00.000Z'),
            });

            expect(
                await new YahooMarketProvider().getTodayBar('005930.KS')
            ).toEqual({
                time: UTC_MIDNIGHT_AUG14,
                open: 274500,
                high: 274500,
                low: 274500,
                close: 274500,
                volume: 0,
            });
        });

        it('treats zero OHL (off-hours quote) as missing and falls back to close', async () => {
            // 2026-10 KRX 휴장 직후 실측: regularMarketOpen/DayHigh/DayLow가 0으로 온다.
            quote.mockResolvedValue({
                regularMarketPrice: 371000,
                regularMarketOpen: 0,
                regularMarketDayHigh: 0,
                regularMarketDayLow: 0,
                regularMarketVolume: 0,
                regularMarketTime: new Date('2026-10-02T06:30:00.000Z'),
            });

            expect(
                await new YahooMarketProvider().getTodayBar('373220.KS')
            ).toEqual({
                time: Math.floor(Date.parse('2026-10-02T00:00:00Z') / 1000),
                open: 371000,
                high: 371000,
                low: 371000,
                close: 371000,
                volume: 0,
            });
        });

        it('treats negative and NaN OHL as missing, keeping a positive partial field', async () => {
            quote.mockResolvedValue({
                regularMarketPrice: 100,
                regularMarketOpen: NaN,
                regularMarketDayHigh: 105,
                regularMarketDayLow: -1,
                regularMarketTime: new Date('2026-08-14T00:00:00.000Z'),
            });

            const bar = await new YahooMarketProvider().getTodayBar(
                '005930.KS'
            );
            expect(bar).toMatchObject({
                open: 100,
                high: 105,
                low: 100,
                close: 100,
            });
        });

        it('returns null for an unlisted symbol', async () => {
            quote.mockResolvedValue(undefined);
            expect(
                await new YahooMarketProvider().getTodayBar('999999.KS')
            ).toBeNull();
        });
    });

    describe('getQuoteSnapshot', () => {
        const row = {
            regularMarketPrice: 274500,
            regularMarketOpen: 275000,
            regularMarketDayHigh: 275500,
            regularMarketDayLow: 266000,
            regularMarketVolume: 21669476,
            regularMarketChangePercent: 1.5,
            longName: 'Samsung Electronics Co., Ltd.',
            regularMarketTime: new Date('2026-08-14T06:30:24.000Z'),
        };

        it('quote 시세와 오늘 봉을 yahoo quote 한 번으로 만든다', async () => {
            quote.mockResolvedValue(row);

            const snapshot = await new YahooMarketProvider().getQuoteSnapshot(
                '005930.KS'
            );

            expect(quote).toHaveBeenCalledTimes(1);
            expect(snapshot.quote).toMatchObject({
                symbol: '005930.KS',
                price: 274500,
                changesPercentage: 1.5,
            });
            expect(snapshot.todayBar).toEqual({
                time: UTC_MIDNIGHT_AUG14,
                open: 275000,
                high: 275500,
                low: 266000,
                close: 274500,
                volume: 21669476,
            });
        });

        it('종목 없음(undefined)은 둘 다 null', async () => {
            quote.mockResolvedValue(undefined);
            expect(
                await new YahooMarketProvider().getQuoteSnapshot('999999.KS')
            ).toEqual({ quote: null, todayBar: null });
        });

        it('yahoo 예외는 던지지 않고 둘 다 null로 degrade', async () => {
            quote.mockRejectedValue(new Error('boom'));
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            try {
                expect(
                    await new YahooMarketProvider().getQuoteSnapshot(
                        '005930.KS'
                    )
                ).toEqual({ quote: null, todayBar: null });
            } finally {
                warn.mockRestore();
            }
        });
    });
});
