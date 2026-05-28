delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
vi.mock('server-only', () => ({}));
vi.mock('@upstash/redis', () => ({
    Redis: vi.fn().mockImplementation(() => ({ get: vi.fn(), set: vi.fn() })),
}));

vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    fetchBarsWithIndicators: vi.fn(),
}));

const mockMarketProvider =
    {} as import('@y0ngha/siglens-core').MarketDataProvider;
vi.mock('@/shared/api/market/getMarketDataProvider', () => ({
    getMarketDataProvider: vi.fn(() => mockMarketProvider),
}));

import type { MockedFunction } from 'vitest';
import { getBarsAction } from '../actions/getBarsAction';
import {
    EMPTY_SMC_RESULT,
    fetchBarsWithIndicators,
} from '@y0ngha/siglens-core';
import type { BarsData } from '@y0ngha/siglens-core';
import { sleep } from '@/shared/lib/sleep';
import { FMP_TEMPORARY_UNAVAILABLE_MESSAGE } from '@/shared/api/fmp/fmpUserMessage';

const mockFetchBarsWithIndicators = fetchBarsWithIndicators as MockedFunction<
    typeof fetchBarsWithIndicators
>;
const sleepMock = sleep as MockedFunction<typeof sleep>;

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
        squeezeMomentum: [],
        buySellVolume: [],
        smc: EMPTY_SMC_RESULT,
    },
};

describe('getBarsAction 함수는', () => {
    beforeEach(() => {
        mockFetchBarsWithIndicators.mockReset();
        sleepMock.mockClear();
        vi.spyOn(Math, 'random').mockReturnValue(0);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });
    describe('정상 응답일 때', () => {
        it('fetchBarsWithIndicators에 올바른 인자를 전달하고 결과를 그대로 반환한다', async () => {
            mockFetchBarsWithIndicators.mockResolvedValueOnce(mockBarsData);

            const result = await getBarsAction('AAPL', '1Day');

            expect(mockFetchBarsWithIndicators).toHaveBeenCalledWith(
                mockMarketProvider,
                'AAPL',
                '1Day',
                undefined
            );
            expect(result).toBe(mockBarsData);
        });

        it('다른 종목과 타임프레임으로도 올바르게 위임한다', async () => {
            mockFetchBarsWithIndicators.mockResolvedValueOnce(mockBarsData);

            await getBarsAction('TSLA', '5Min');

            expect(mockFetchBarsWithIndicators).toHaveBeenCalledWith(
                mockMarketProvider,
                'TSLA',
                '5Min',
                undefined
            );
        });

        it('fmpSymbol이 주어지면 fetchBarsWithIndicators에 그대로 전달한다', async () => {
            mockFetchBarsWithIndicators.mockResolvedValueOnce(mockBarsData);

            await getBarsAction('SPX', '1Day', '^SPX');

            expect(mockFetchBarsWithIndicators).toHaveBeenCalledWith(
                mockMarketProvider,
                'SPX',
                '1Day',
                '^SPX'
            );
        });
    });

    describe('fetchBarsWithIndicators가 에러를 던질 때', () => {
        it('에러를 전파한다', async () => {
            mockFetchBarsWithIndicators.mockRejectedValueOnce(
                new Error('Fetch failed')
            );

            await expect(getBarsAction('AAPL', '1Day')).rejects.toThrow(
                'Fetch failed'
            );
            expect(mockFetchBarsWithIndicators).toHaveBeenCalledTimes(1);
            expect(sleepMock).not.toHaveBeenCalled();
        });

        it('FMP 402는 원본 에러를 그대로 전파한다', async () => {
            mockFetchBarsWithIndicators.mockRejectedValueOnce(
                new Error('FMP API error: 402 Payment Required')
            );

            await expect(getBarsAction('AAPL', '1Day')).rejects.toThrow(
                'FMP API error: 402 Payment Required'
            );
            expect(mockFetchBarsWithIndicators).toHaveBeenCalledTimes(1);
            expect(sleepMock).not.toHaveBeenCalled();
        });
    });
});
