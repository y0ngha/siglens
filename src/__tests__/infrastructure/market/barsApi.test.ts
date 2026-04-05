import { fetchBarsWithIndicators } from '@/infrastructure/market/barsApi';
import {
    DEFAULT_TIMEFRAME,
    TIMEFRAME_BARS_LIMIT,
} from '@/domain/constants/market';
import {
    MA_DEFAULT_PERIODS,
    EMA_DEFAULT_PERIODS,
    RSI_DEFAULT_PERIOD,
    MACD_SLOW_PERIOD,
    BOLLINGER_DEFAULT_PERIOD,
    DMI_DEFAULT_PERIOD,
} from '@/domain/indicators/constants';

jest.mock('@/infrastructure/market/alpaca');

import { getBars } from '@/infrastructure/market/alpaca';

// jest.mock()으로 모킹된 모듈은 런타임에 MockedFunction으로 교체되지만
// TypeScript는 원본 타입으로 인식하므로 as 단언 필요
const mockGetBars = getBars as jest.MockedFunction<typeof getBars>;

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
            expect(Array.isArray(result.indicators.ma)).toBe(false);
            expect(typeof result.indicators.ma).toBe('object');
            expect(
                MA_DEFAULT_PERIODS.every(period =>
                    Object.prototype.hasOwnProperty.call(
                        result.indicators.ma,
                        String(period)
                    )
                )
            ).toBe(true);
            expect(Array.isArray(result.indicators.ema)).toBe(false);
            expect(typeof result.indicators.ema).toBe('object');
            expect(
                EMA_DEFAULT_PERIODS.every(period =>
                    Object.prototype.hasOwnProperty.call(
                        result.indicators.ema,
                        String(period)
                    )
                )
            ).toBe(true);
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

        it('symbol과 timeframe으로 올바른 파라미터를 getBars에 전달한다', async () => {
            mockGetBars.mockResolvedValueOnce([]);

            await fetchBarsWithIndicators('TSLA', DEFAULT_TIMEFRAME);

            expect(mockGetBars).toHaveBeenCalledWith(
                expect.objectContaining({
                    symbol: 'TSLA',
                    timeframe: DEFAULT_TIMEFRAME,
                    limit: TIMEFRAME_BARS_LIMIT[DEFAULT_TIMEFRAME],
                })
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
