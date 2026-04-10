import { getBarsAction } from '@/infrastructure/market/getBarsAction';
import type { BarsData, Timeframe } from '@/domain/types';

jest.mock('@/infrastructure/market/barsApi');

import { fetchBarsWithIndicators } from '@/infrastructure/market/barsApi';

const mockFetchBarsWithIndicators =
    fetchBarsWithIndicators as jest.MockedFunction<
        typeof fetchBarsWithIndicators
    >;

const mockBarsData: BarsData = {
    bars: [
        {
            time: 1705312200,
            open: 100,
            high: 105,
            low: 99,
            close: 103,
            volume: 1000000,
        },
    ],
    indicators: {
        macd: [],
        bollinger: [],
        dmi: [],
        stochastic: [],
        stochRsi: [],
        rsi: [],
        cci: [],
        vwap: [],
        ma: {},
        ema: {},
        volumeProfile: null,
        ichimoku: [],
        atr: [],
        obv: [],
        parabolicSar: [],
        williamsR: [],
        supertrend: [],
        mfi: [],
        keltnerChannel: [],
        cmf: [],
        donchianChannel: [],
    },
};

describe('getBarsAction 함수는', () => {
    beforeEach(() => {
        mockFetchBarsWithIndicators.mockReset();
    });
    describe('정상 응답일 때', () => {
        it('fetchBarsWithIndicators에 올바른 인자를 전달하고 결과를 그대로 반환한다', async () => {
            mockFetchBarsWithIndicators.mockResolvedValueOnce(mockBarsData);

            const result = await getBarsAction('AAPL', '1Day' as Timeframe);

            expect(mockFetchBarsWithIndicators).toHaveBeenCalledWith(
                'AAPL',
                '1Day'
            );
            expect(result).toBe(mockBarsData);
        });

        it('다른 symbol과 timeframe으로도 올바르게 위임한다', async () => {
            mockFetchBarsWithIndicators.mockResolvedValueOnce(mockBarsData);

            await getBarsAction('TSLA', '1Min' as Timeframe);

            expect(mockFetchBarsWithIndicators).toHaveBeenCalledWith(
                'TSLA',
                '1Min'
            );
        });
    });

    describe('fetchBarsWithIndicators가 에러를 던질 때', () => {
        it('에러를 전파한다', async () => {
            mockFetchBarsWithIndicators.mockRejectedValueOnce(
                new Error('Fetch failed')
            );

            await expect(
                getBarsAction('AAPL', '1Day' as Timeframe)
            ).rejects.toThrow('Fetch failed');
        });
    });
});
