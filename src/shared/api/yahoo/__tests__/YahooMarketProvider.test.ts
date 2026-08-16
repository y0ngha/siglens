import { describe, it, expect, vi, beforeEach } from 'vitest';

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
            // core Timeframe 타입은 여전히 4Hour를 포함하므로 방어한다.
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

        it('returns null for an unlisted symbol', async () => {
            quote.mockResolvedValue(undefined);
            expect(
                await new YahooMarketProvider().getTodayBar('999999.KS')
            ).toBeNull();
        });
    });
});
