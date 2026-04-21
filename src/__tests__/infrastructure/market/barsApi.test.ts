jest.mock('next/cache', () => ({
    cacheLife: jest.fn(),
    cacheTag: jest.fn(),
}));

import { cacheLife, cacheTag } from 'next/cache';
import { fetchBarsWithIndicators } from '@/infrastructure/market/barsApi';
import {
    DEFAULT_TIMEFRAME,
    TIMEFRAME_BARS_LIMIT,
} from '@/domain/constants/market';
import {
    BOLLINGER_DEFAULT_PERIOD,
    DMI_DEFAULT_PERIOD,
    EMA_DEFAULT_PERIODS,
    MA_DEFAULT_PERIODS,
    MACD_SLOW_PERIOD,
    RSI_DEFAULT_PERIOD,
} from '@/domain/indicators/constants';
import { createMarketDataProvider } from '@/infrastructure/market/factory';

jest.mock('@/infrastructure/market/factory');

const mockGetBars = jest.fn();

const mockBar = {
    time: 1705312200,
    open: 100,
    high: 105,
    low: 99,
    close: 103,
    volume: 1000000,
};

describe('fetchBarsWithIndicators 함수는', () => {
    beforeEach(() => {
        mockGetBars.mockReset();
        // jest.mock()으로 모킹된 모듈은 런타임에 MockedFunction으로 교체되지만
        // TypeScript가 원본 타입을 인식하기 때문에 as jest.Mock assertion 필요
        (createMarketDataProvider as jest.Mock).mockReturnValue({
            getBars: mockGetBars,
        });
    });
    describe('정상 응답일 때', () => {
        it('bars와 indicators를 포함한 BarsData를 반환한다', async () => {
            mockGetBars.mockResolvedValueOnce([mockBar]);

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
            expect(typeof result.indicators.ma).toBe('object');
            expect(
                MA_DEFAULT_PERIODS.every(period =>
                    Object.prototype.hasOwnProperty.call(
                        result.indicators.ma,
                        String(period)
                    )
                )
            ).toBe(true);
            MA_DEFAULT_PERIODS.forEach(period => {
                expect(Array.isArray(result.indicators.ma[period])).toBe(true);
            });
            expect(typeof result.indicators.ema).toBe('object');
            expect(
                EMA_DEFAULT_PERIODS.every(period =>
                    Object.prototype.hasOwnProperty.call(
                        result.indicators.ema,
                        String(period)
                    )
                )
            ).toBe(true);
            EMA_DEFAULT_PERIODS.forEach(period => {
                expect(Array.isArray(result.indicators.ema[period])).toBe(true);
            });
        });

        it('bar가 1개일 때 기간 기반 인디케이터의 첫 번째 값은 null이다', async () => {
            mockGetBars.mockResolvedValueOnce([mockBar]);

            const result = await fetchBarsWithIndicators(
                'AAPL',
                DEFAULT_TIMEFRAME
            );

            expect(result.indicators.rsi[0]).toBeNull();
            expect(result.indicators.macd[0].macd).toBeNull();
            expect(result.indicators.macd[0].signal).toBeNull();
            expect(result.indicators.bollinger[0].upper).toBeNull();
            expect(result.indicators.bollinger[0].middle).toBeNull();
            expect(result.indicators.dmi[0].diPlus).toBeNull();
            expect(result.indicators.dmi[0].adx).toBeNull();
            expect(
                MA_DEFAULT_PERIODS.every(
                    period => result.indicators.ma[period]?.[0] === null
                )
            ).toBe(true);
            expect(
                EMA_DEFAULT_PERIODS.every(
                    period => result.indicators.ema[period]?.[0] === null
                )
            ).toBe(true);
        });

        it('bars가 RSI_DEFAULT_PERIOD - 1개일 때 모든 rsi 값은 null이다', async () => {
            const shortBars = Array.from(
                { length: RSI_DEFAULT_PERIOD - 1 },
                (_, i) => ({ ...mockBar, time: mockBar.time + i * 60 })
            );
            mockGetBars.mockResolvedValueOnce(shortBars);

            const result = await fetchBarsWithIndicators(
                'AAPL',
                DEFAULT_TIMEFRAME
            );

            expect(result.indicators.rsi.every(v => v === null)).toBe(true);
        });

        it('bars가 MACD_SLOW_PERIOD - 1개일 때 모든 macd 값은 null이다', async () => {
            const shortBars = Array.from(
                { length: MACD_SLOW_PERIOD - 1 },
                (_, i) => ({ ...mockBar, time: mockBar.time + i * 60 })
            );
            mockGetBars.mockResolvedValueOnce(shortBars);

            const result = await fetchBarsWithIndicators(
                'AAPL',
                DEFAULT_TIMEFRAME
            );

            expect(result.indicators.macd.every(v => v.macd === null)).toBe(
                true
            );
        });

        it('bars가 BOLLINGER_DEFAULT_PERIOD - 1개일 때 모든 bollinger 값은 null이다', async () => {
            const shortBars = Array.from(
                { length: BOLLINGER_DEFAULT_PERIOD - 1 },
                (_, i) => ({ ...mockBar, time: mockBar.time + i * 60 })
            );
            mockGetBars.mockResolvedValueOnce(shortBars);

            const result = await fetchBarsWithIndicators(
                'AAPL',
                DEFAULT_TIMEFRAME
            );

            expect(
                result.indicators.bollinger.every(v => v.upper === null)
            ).toBe(true);
        });

        it('bars가 DMI_DEFAULT_PERIOD - 1개일 때 모든 dmi 값은 null이다', async () => {
            const shortBars = Array.from(
                { length: DMI_DEFAULT_PERIOD - 1 },
                (_, i) => ({ ...mockBar, time: mockBar.time + i * 60 })
            );
            mockGetBars.mockResolvedValueOnce(shortBars);

            const result = await fetchBarsWithIndicators(
                'AAPL',
                DEFAULT_TIMEFRAME
            );

            expect(result.indicators.dmi.every(v => v.diPlus === null)).toBe(
                true
            );
        });

        it('symbol, timeframe, limit, from 파라미터를 getBars에 전달한다', async () => {
            mockGetBars.mockResolvedValueOnce([]);

            await fetchBarsWithIndicators('TSLA', DEFAULT_TIMEFRAME);

            expect(mockGetBars).toHaveBeenCalledWith(
                expect.objectContaining({
                    symbol: 'TSLA',
                    timeframe: DEFAULT_TIMEFRAME,
                    limit: TIMEFRAME_BARS_LIMIT[DEFAULT_TIMEFRAME],
                    from: expect.stringMatching(
                        /^\d{4}-\d{2}-\d{2}T00:00:00Z$/
                    ),
                })
            );
        });

        it('cacheTag와 cacheLife를 올바른 인수로 호출한다', async () => {
            mockGetBars.mockResolvedValueOnce([]);
            const mockCacheTag = cacheTag as jest.Mock;
            const mockCacheLife = cacheLife as jest.Mock;

            await fetchBarsWithIndicators('TSLA', DEFAULT_TIMEFRAME);

            expect(mockCacheTag).toHaveBeenCalledWith(
                `bars:TSLA:${DEFAULT_TIMEFRAME}`
            );
            expect(mockCacheLife).toHaveBeenCalledWith('minutes');
        });

        it('fmpSymbol이 주어지면 getBars에 fmpSymbol을 전달한다', async () => {
            mockGetBars.mockResolvedValueOnce([]);

            await fetchBarsWithIndicators('SPX', DEFAULT_TIMEFRAME, '^SPX');

            expect(mockGetBars).toHaveBeenCalledWith(
                expect.objectContaining({ symbol: '^SPX' })
            );
        });

        it('fmpSymbol이 주어지면 cacheTag에 fmpSymbol을 사용한다', async () => {
            mockGetBars.mockResolvedValueOnce([]);
            const mockCacheTag = cacheTag as jest.Mock;

            await fetchBarsWithIndicators('SPX', DEFAULT_TIMEFRAME, '^SPX');

            expect(mockCacheTag).toHaveBeenCalledWith(
                `bars:^SPX:${DEFAULT_TIMEFRAME}`
            );
        });
    });

    describe('getBars가 에러를 던질 때', () => {
        it('에러를 전파한다', async () => {
            mockGetBars.mockRejectedValueOnce(
                new Error('Failed to fetch bars')
            );

            await expect(
                fetchBarsWithIndicators('AAPL', DEFAULT_TIMEFRAME)
            ).rejects.toThrow('Failed to fetch bars');
        });
    });
});
