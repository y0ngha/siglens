import {
    EMA_DEFAULT_PERIODS,
    EMPTY_INDICATOR_RESULT,
    MA_DEFAULT_PERIODS,
} from '@/domain/indicators/constants';

describe('EMPTY_INDICATOR_RESULT', () => {
    describe('배열 필드일 때', () => {
        it('rsi가 빈 배열이다', () => {
            expect(EMPTY_INDICATOR_RESULT.rsi).toEqual([]);
        });

        it('macd가 빈 배열이다', () => {
            expect(EMPTY_INDICATOR_RESULT.macd).toEqual([]);
        });

        it('bollinger가 빈 배열이다', () => {
            expect(EMPTY_INDICATOR_RESULT.bollinger).toEqual([]);
        });

        it('dmi가 빈 배열이다', () => {
            expect(EMPTY_INDICATOR_RESULT.dmi).toEqual([]);
        });

        it('stochastic이 빈 배열이다', () => {
            expect(EMPTY_INDICATOR_RESULT.stochastic).toEqual([]);
        });

        it('stochRsi가 빈 배열이다', () => {
            expect(EMPTY_INDICATOR_RESULT.stochRsi).toEqual([]);
        });

        it('cci가 빈 배열이다', () => {
            expect(EMPTY_INDICATOR_RESULT.cci).toEqual([]);
        });

        it('vwap이 빈 배열이다', () => {
            expect(EMPTY_INDICATOR_RESULT.vwap).toEqual([]);
        });

        it('ichimoku가 빈 배열이다', () => {
            expect(EMPTY_INDICATOR_RESULT.ichimoku).toEqual([]);
        });

        it('atr이 빈 배열이다', () => {
            expect(EMPTY_INDICATOR_RESULT.atr).toEqual([]);
        });

        it('obv가 빈 배열이다', () => {
            expect(EMPTY_INDICATOR_RESULT.obv).toEqual([]);
        });

        it('parabolicSar가 빈 배열이다', () => {
            expect(EMPTY_INDICATOR_RESULT.parabolicSar).toEqual([]);
        });

        it('williamsR이 빈 배열이다', () => {
            expect(EMPTY_INDICATOR_RESULT.williamsR).toEqual([]);
        });

        it('supertrend가 빈 배열이다', () => {
            expect(EMPTY_INDICATOR_RESULT.supertrend).toEqual([]);
        });

        it('mfi가 빈 배열이다', () => {
            expect(EMPTY_INDICATOR_RESULT.mfi).toEqual([]);
        });

        it('keltnerChannel이 빈 배열이다', () => {
            expect(EMPTY_INDICATOR_RESULT.keltnerChannel).toEqual([]);
        });

        it('cmf가 빈 배열이다', () => {
            expect(EMPTY_INDICATOR_RESULT.cmf).toEqual([]);
        });

        it('donchianChannel이 빈 배열이다', () => {
            expect(EMPTY_INDICATOR_RESULT.donchianChannel).toEqual([]);
        });

        it('buySellVolume이 빈 배열이다', () => {
            expect(EMPTY_INDICATOR_RESULT.buySellVolume).toEqual([]);
        });
    });

    describe('Record 필드일 때', () => {
        it('ma가 빈 객체이다', () => {
            expect(EMPTY_INDICATOR_RESULT.ma).toEqual({});
        });

        it('ema가 빈 객체이다', () => {
            expect(EMPTY_INDICATOR_RESULT.ema).toEqual({});
        });

        it('ma에 MA_DEFAULT_PERIODS 키가 존재하지 않는다', () => {
            expect(
                MA_DEFAULT_PERIODS.every(
                    period =>
                        !Object.prototype.hasOwnProperty.call(
                            EMPTY_INDICATOR_RESULT.ma,
                            period
                        )
                )
            ).toBe(true);
        });

        it('ema에 EMA_DEFAULT_PERIODS 키가 존재하지 않는다', () => {
            expect(
                EMA_DEFAULT_PERIODS.every(
                    period =>
                        !Object.prototype.hasOwnProperty.call(
                            EMPTY_INDICATOR_RESULT.ema,
                            period
                        )
                )
            ).toBe(true);
        });
    });
});
