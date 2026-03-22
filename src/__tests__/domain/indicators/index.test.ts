import { SECONDS_PER_DAY } from '@/domain/constants/time';
import {
    calculateIndicators,
    calculateRSI,
    calculateMACD,
    calculateBollinger,
    calculateDMI,
    calculateVWAP,
    calculateEMA,
    calculateMA,
} from '@/domain/indicators';
import {
    MA_DEFAULT_PERIODS,
    EMA_DEFAULT_PERIODS,
} from '@/domain/indicators/constants';
import type { Bar } from '@/domain/types';

function makeBar(overrides: Partial<Bar> & { time: number }): Bar {
    return {
        open: 100,
        high: 105,
        low: 95,
        close: 100,
        volume: 1000,
        ...overrides,
    };
}

function makeBars(count: number): Bar[] {
    return Array.from({ length: count }, (_, i) =>
        makeBar({
            time: i * SECONDS_PER_DAY,
            close: 100 + i,
            high: 105 + i,
            low: 95 + i,
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
    });

    describe('정상 입력일 때', () => {
        const bars = makeBars(100);

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
    });

    describe('개별 인디케이터 함수와 결과가 일치할 때', () => {
        const bars = makeBars(100);
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

        it('ma[20]이 calculateMA(bars, 20) 결과와 같다', () => {
            expect(calculateIndicators(bars).ma[20]).toEqual(
                calculateMA(bars, 20)
            );
        });

        it('ema[9]가 calculateEMA(bars, 9) 결과와 같다', () => {
            expect(calculateIndicators(bars).ema[9]).toEqual(
                calculateEMA(bars, 9)
            );
        });
    });
});
