import { SECONDS_PER_DAY } from '@/domain/constants/time';
import {
    calculateBollinger,
    calculateDMI,
    calculateEMA,
    calculateIchimoku,
    calculateIndicators,
    calculateMA,
    calculateMACD,
    calculateRSI,
    calculateVolumeProfile,
    calculateVWAP,
} from '@/domain/indicators';
import {
    BOLLINGER_DEFAULT_PERIOD,
    DMI_DEFAULT_PERIOD,
    EMA_DEFAULT_PERIODS,
    ICHIMOKU_BASE_PERIOD,
    MA_DEFAULT_PERIODS,
    MACD_SIGNAL_PERIOD,
    MACD_SLOW_PERIOD,
    RSI_DEFAULT_PERIOD,
} from '@/domain/indicators/constants';
import type { Bar } from '@/domain/types';

const TEST_BAR_COUNT = 100;
const DEFAULT_OPEN = 100;
const DEFAULT_HIGH = 105;
const DEFAULT_LOW = 95;
const DEFAULT_CLOSE = 100;
const DEFAULT_VOLUME = 1000;

function makeBar(overrides: Partial<Bar> & { time: number }): Bar {
    return {
        open: DEFAULT_OPEN,
        high: DEFAULT_HIGH,
        low: DEFAULT_LOW,
        close: DEFAULT_CLOSE,
        volume: DEFAULT_VOLUME,
        ...overrides,
    };
}

function makeBars(count: number): Bar[] {
    return Array.from({ length: count }, (_, i) =>
        makeBar({
            time: i * SECONDS_PER_DAY,
            close: DEFAULT_CLOSE + i,
            high: DEFAULT_HIGH + i,
            low: DEFAULT_LOW + i,
        })
    );
}

describe('calculateIndicators', () => {
    describe('입력 배열이 비어있을 때', () => {
        it('rsi가 빈 배열을 반환한다', () => {
            expect(calculateIndicators([]).rsi).toEqual([]);
        });

        it('macd가 빈 배열을 반환한다', () => {
            expect(calculateIndicators([]).macd).toEqual([]);
        });

        it('bollinger가 빈 배열을 반환한다', () => {
            expect(calculateIndicators([]).bollinger).toEqual([]);
        });

        it('dmi가 빈 배열을 반환한다', () => {
            expect(calculateIndicators([]).dmi).toEqual([]);
        });

        it('vwap이 빈 배열을 반환한다', () => {
            expect(calculateIndicators([]).vwap).toEqual([]);
        });

        it('ma의 각 기간별 결과가 빈 배열을 반환한다', () => {
            const result = calculateIndicators([]);
            MA_DEFAULT_PERIODS.forEach(period => {
                expect(result.ma[period]).toEqual([]);
            });
        });

        it('ema의 각 기간별 결과가 빈 배열을 반환한다', () => {
            const result = calculateIndicators([]);
            EMA_DEFAULT_PERIODS.forEach(period => {
                expect(result.ema[period]).toEqual([]);
            });
        });

        it('volumeProfile이 null을 반환한다', () => {
            expect(calculateIndicators([]).volumeProfile).toBeNull();
        });

        it('ichimoku가 빈 배열을 반환한다', () => {
            expect(calculateIndicators([]).ichimoku).toEqual([]);
        });
    });

    describe('정상 입력일 때', () => {
        const bars = makeBars(TEST_BAR_COUNT);

        it('rsi의 길이가 bars.length와 같다', () => {
            expect(calculateIndicators(bars).rsi).toHaveLength(bars.length);
        });

        it('macd의 길이가 bars.length와 같다', () => {
            expect(calculateIndicators(bars).macd).toHaveLength(bars.length);
        });

        it('bollinger의 길이가 bars.length와 같다', () => {
            expect(calculateIndicators(bars).bollinger).toHaveLength(
                bars.length
            );
        });

        it('dmi의 길이가 bars.length와 같다', () => {
            expect(calculateIndicators(bars).dmi).toHaveLength(bars.length);
        });

        it('vwap의 길이가 bars.length와 같다', () => {
            expect(calculateIndicators(bars).vwap).toHaveLength(bars.length);
        });

        it('ma에 MA_DEFAULT_PERIODS의 모든 기간이 포함된다', () => {
            const result = calculateIndicators(bars);
            MA_DEFAULT_PERIODS.forEach(period => {
                expect(result.ma[period]).toBeDefined();
            });
        });

        it('ma의 각 기간별 결과 길이가 bars.length와 같다', () => {
            const result = calculateIndicators(bars);
            MA_DEFAULT_PERIODS.forEach(period => {
                expect(result.ma[period]).toHaveLength(bars.length);
            });
        });

        it('ema에 EMA_DEFAULT_PERIODS의 모든 기간이 포함된다', () => {
            const result = calculateIndicators(bars);
            EMA_DEFAULT_PERIODS.forEach(period => {
                expect(result.ema[period]).toBeDefined();
            });
        });

        it('ema의 각 기간별 결과 길이가 bars.length와 같다', () => {
            const result = calculateIndicators(bars);
            EMA_DEFAULT_PERIODS.forEach(period => {
                expect(result.ema[period]).toHaveLength(bars.length);
            });
        });

        it('ichimoku의 길이가 bars.length와 같다', () => {
            expect(calculateIndicators(bars).ichimoku).toHaveLength(
                bars.length
            );
        });
    });

    describe('초기 구간이 null일 때', () => {
        const bars = makeBars(TEST_BAR_COUNT);

        it('rsi의 처음 RSI_DEFAULT_PERIOD - 1개의 값은 null이다', () => {
            const { rsi } = calculateIndicators(bars);
            expect(
                rsi.slice(0, RSI_DEFAULT_PERIOD - 1).every(v => v === null)
            ).toBe(true);
        });

        it('macd의 처음 MACD_SLOW_PERIOD + MACD_SIGNAL_PERIOD - 2개의 값은 모두 histogram이 null이다', () => {
            const { macd } = calculateIndicators(bars);
            const nullCount = MACD_SLOW_PERIOD + MACD_SIGNAL_PERIOD - 2;
            expect(
                macd.slice(0, nullCount).every(v => v.histogram === null)
            ).toBe(true);
        });

        it('bollinger의 처음 BOLLINGER_DEFAULT_PERIOD - 1개의 값은 middle이 null이다', () => {
            const { bollinger } = calculateIndicators(bars);
            expect(
                bollinger
                    .slice(0, BOLLINGER_DEFAULT_PERIOD - 1)
                    .every(v => v.middle === null)
            ).toBe(true);
        });

        it('dmi의 처음 DMI_DEFAULT_PERIOD * 2 - 1개의 값은 adx가 null이다', () => {
            const { dmi } = calculateIndicators(bars);
            const nullCount = DMI_DEFAULT_PERIOD * 2 - 1;
            expect(dmi.slice(0, nullCount).every(v => v.adx === null)).toBe(
                true
            );
        });

        it('ma의 각 기간별 처음 period - 1개의 값은 null이다', () => {
            const result = calculateIndicators(bars);
            MA_DEFAULT_PERIODS.forEach(period => {
                expect(
                    result.ma[period]
                        .slice(0, period - 1)
                        .every(v => v === null)
                ).toBe(true);
            });
        });

        it('ema의 각 기간별 처음 period - 1개의 값은 null이다', () => {
            const result = calculateIndicators(bars);
            EMA_DEFAULT_PERIODS.forEach(period => {
                expect(
                    result.ema[period]
                        .slice(0, period - 1)
                        .every(v => v === null)
                ).toBe(true);
            });
        });

        it('ichimoku의 처음 ICHIMOKU_BASE_PERIOD - 1개의 값은 kijun이 null이다', () => {
            const { ichimoku } = calculateIndicators(bars);
            expect(
                ichimoku
                    .slice(0, ICHIMOKU_BASE_PERIOD - 1)
                    .every(v => v.kijun === null)
            ).toBe(true);
        });
    });

    describe('개별 인디케이터 함수와 결과가 일치할 때', () => {
        const bars = makeBars(TEST_BAR_COUNT);
        const closes = bars.map(b => b.close);

        it('rsi가 calculateRSI 결과와 같다', () => {
            expect(calculateIndicators(bars).rsi).toEqual(calculateRSI(closes));
        });

        it('macd가 calculateMACD 결과와 같다', () => {
            expect(calculateIndicators(bars).macd).toEqual(calculateMACD(bars));
        });

        it('bollinger가 calculateBollinger 결과와 같다', () => {
            expect(calculateIndicators(bars).bollinger).toEqual(
                calculateBollinger(bars)
            );
        });

        it('dmi가 calculateDMI 결과와 같다', () => {
            expect(calculateIndicators(bars).dmi).toEqual(calculateDMI(bars));
        });

        it('vwap이 calculateVWAP 결과와 같다', () => {
            expect(calculateIndicators(bars).vwap).toEqual(calculateVWAP(bars));
        });

        it('ma[MA_DEFAULT_PERIODS[0]]이 calculateMA 결과와 같다', () => {
            const period = MA_DEFAULT_PERIODS[0];
            expect(calculateIndicators(bars).ma[period]).toEqual(
                calculateMA(bars, period)
            );
        });

        it('ema[EMA_DEFAULT_PERIODS[0]]이 calculateEMA 결과와 같다', () => {
            const period = EMA_DEFAULT_PERIODS[0];
            expect(calculateIndicators(bars).ema[period]).toEqual(
                calculateEMA(bars, period)
            );
        });

        it('volumeProfile이 calculateVolumeProfile 결과와 같다', () => {
            expect(calculateIndicators(bars).volumeProfile).toEqual(
                calculateVolumeProfile(bars)
            );
        });

        it('ichimoku가 calculateIchimoku 결과와 같다', () => {
            expect(calculateIndicators(bars).ichimoku).toEqual(
                calculateIchimoku(bars)
            );
        });
    });
});
