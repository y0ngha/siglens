import { calculateMACD } from '@/domain/indicators/macd';
import {
    MACD_FAST_PERIOD,
    MACD_SIGNAL_PERIOD,
    MACD_SLOW_PERIOD,
} from '@/domain/indicators/constants';
import type { Bar } from '@/domain/types';

function makeBars(closes: number[]): Bar[] {
    return closes.map((close, i) => ({
        time: i,
        open: close,
        high: close,
        low: close,
        close,
        volume: 1,
    }));
}

describe('calculateMACD', () => {
    describe('입력 배열이 비어있을 때', () => {
        it('빈 배열을 반환한다', () => {
            expect(calculateMACD([])).toEqual([]);
        });
    });

    describe('입력 배열 길이가 slowPeriod 미만일 때', () => {
        it('전부 null인 배열을 반환한다', () => {
            const bars = makeBars(
                Array.from({ length: 20 }, (_, i) => 100 + i)
            );
            const result = calculateMACD(bars);
            expect(
                result.every(
                    r =>
                        r.macd === null &&
                        r.signal === null &&
                        r.histogram === null
                )
            ).toBe(true);
        });
    });

    describe('입력 배열 길이가 slowPeriod 이상 slowPeriod+signalPeriod-1 미만일 때', () => {
        it('macd 값은 있으나 signal과 histogram은 null이다', () => {
            // slowPeriod = 26, signalPeriod = 9 → 완전한 시그널은 34번째부터
            // 30개 데이터: macd는 index 25부터 값 있음, signal은 아직 null
            const bars = makeBars(
                Array.from({ length: 30 }, (_, i) => 100 + i)
            );
            const result = calculateMACD(bars);
            // index 25 이후는 macd 값이 있어야 함
            expect(result[MACD_SLOW_PERIOD - 1].macd).not.toBeNull();
            // signal은 아직 null
            expect(result[MACD_SLOW_PERIOD - 1].signal).toBeNull();
            expect(result[MACD_SLOW_PERIOD - 1].histogram).toBeNull();
        });
    });

    describe('입력 배열 길이가 slowPeriod+signalPeriod-1 이상일 때', () => {
        const NULL_COUNT = MACD_SLOW_PERIOD + MACD_SIGNAL_PERIOD - 1; // 34

        it('입력과 동일한 길이의 배열을 반환한다', () => {
            const bars = makeBars(
                Array.from({ length: 50 }, (_, i) => 100 + i)
            );
            expect(calculateMACD(bars)).toHaveLength(50);
        });

        it('처음 slowPeriod - 1개의 macd 값은 null이다', () => {
            const bars = makeBars(
                Array.from({ length: 50 }, (_, i) => 100 + i)
            );
            const result = calculateMACD(bars);
            expect(
                result
                    .slice(0, MACD_SLOW_PERIOD - 1)
                    .every(r => r.macd === null)
            ).toBe(true);
        });

        it('처음 NULL_COUNT개의 signal과 histogram은 null이다', () => {
            const bars = makeBars(
                Array.from({ length: 50 }, (_, i) => 100 + i)
            );
            const result = calculateMACD(bars);
            expect(
                result
                    .slice(0, NULL_COUNT)
                    .every(r => r.signal === null && r.histogram === null)
            ).toBe(true);
        });

        it('NULL_COUNT번째 이후 signal과 histogram은 null이 아닌 숫자다', () => {
            const bars = makeBars(
                Array.from({ length: 50 }, (_, i) => 100 + i)
            );
            const result = calculateMACD(bars);
            result.slice(NULL_COUNT).forEach(r => {
                expect(typeof r.macd).toBe('number');
                expect(typeof r.signal).toBe('number');
                expect(typeof r.histogram).toBe('number');
            });
        });

        it('histogram = macd - signal이다', () => {
            const bars = makeBars(
                Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i) * 10)
            );
            const result = calculateMACD(bars);
            result.slice(NULL_COUNT).forEach(r => {
                expect(r.histogram).toBeCloseTo(
                    (r.macd as number) - (r.signal as number),
                    10
                );
            });
        });

        it('기본값은 fast=12, slow=26, signal=9다', () => {
            const bars = makeBars(
                Array.from({ length: 50 }, (_, i) => 100 + i)
            );
            expect(calculateMACD(bars)).toEqual(
                calculateMACD(
                    bars,
                    MACD_FAST_PERIOD,
                    MACD_SLOW_PERIOD,
                    MACD_SIGNAL_PERIOD
                )
            );
        });

        it('반환값은 MACDResult[] 타입이다', () => {
            const bars = makeBars(
                Array.from({ length: 50 }, (_, i) => 100 + i)
            );
            const result = calculateMACD(bars);
            result.forEach(r => {
                expect(r).toHaveProperty('macd');
                expect(r).toHaveProperty('signal');
                expect(r).toHaveProperty('histogram');
            });
        });

        it('가격이 일정할 때 macdLine은 0에 수렴한다', () => {
            const bars = makeBars(Array.from({ length: 100 }, () => 100));
            const result = calculateMACD(bars);
            result.slice(NULL_COUNT).forEach(r => {
                expect(r.macd as number).toBeCloseTo(0, 10);
            });
        });
    });
});
