import { calculateBollinger } from '@/domain/indicators/bollinger';
import {
    BOLLINGER_DEFAULT_PERIOD,
    BOLLINGER_DEFAULT_STD_DEV,
} from '@/domain/indicators/constants';
import type { Bar, BollingerResult } from '@/domain/types';

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

describe('calculateBollinger', () => {
    describe('입력 배열이 비어있을 때', () => {
        it('빈 배열을 반환한다', () => {
            expect(calculateBollinger([])).toEqual([]);
        });
    });

    describe('입력 배열 길이가 period 미만일 때', () => {
        it('전부 null인 배열을 반환한다', () => {
            const bars = makeBars(
                Array.from(
                    { length: BOLLINGER_DEFAULT_PERIOD - 1 },
                    (_, i) => 100 + i
                )
            );
            const result = calculateBollinger(bars);
            expect(result).toHaveLength(bars.length);
            expect(
                result.every(
                    (r: BollingerResult) =>
                        r.upper === null &&
                        r.middle === null &&
                        r.lower === null
                )
            ).toBe(true);
        });
    });

    describe('입력 배열 길이가 period 이상일 때', () => {
        const period = BOLLINGER_DEFAULT_PERIOD;

        it('입력과 동일한 길이의 배열을 반환한다', () => {
            const bars = makeBars(
                Array.from({ length: 50 }, (_, i) => 100 + i)
            );
            expect(calculateBollinger(bars)).toHaveLength(50);
        });

        it('처음 period - 1개의 값은 null이다', () => {
            const bars = makeBars(
                Array.from({ length: 50 }, (_, i) => 100 + i)
            );
            const result = calculateBollinger(bars);
            expect(
                result
                    .slice(0, period - 1)
                    .every(
                        (r: BollingerResult) =>
                            r.upper === null &&
                            r.middle === null &&
                            r.lower === null
                    )
            ).toBe(true);
        });

        it('period번째 이후 값은 null이 아닌 숫자다', () => {
            const bars = makeBars(
                Array.from({ length: 50 }, (_, i) => 100 + i)
            );
            const result = calculateBollinger(bars);
            result.slice(period - 1).forEach((r: BollingerResult) => {
                expect(typeof r.upper).toBe('number');
                expect(typeof r.middle).toBe('number');
                expect(typeof r.lower).toBe('number');
            });
        });

        it('첫 번째 유효값의 middle은 처음 period개 종가의 SMA다', () => {
            const closes = Array.from({ length: 25 }, (_, i) => 100 + i);
            const bars = makeBars(closes);
            const result = calculateBollinger(bars);
            const expectedMiddle =
                closes.slice(0, period).reduce((sum, v) => sum + v, 0) / period;
            expect(result[period - 1].middle).toBeCloseTo(expectedMiddle, 10);
        });

        it('upper = middle + stdDev * std이다', () => {
            const bars = makeBars(
                Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i) * 10)
            );
            const result = calculateBollinger(bars);
            result.slice(period - 1).forEach((r: BollingerResult) => {
                expect((r.upper as number) - (r.middle as number)).toBeCloseTo(
                    (r.middle as number) - (r.lower as number),
                    10
                );
            });
        });

        it('upper > middle > lower다', () => {
            const bars = makeBars(
                Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i) * 10)
            );
            const result = calculateBollinger(bars);
            result.slice(period - 1).forEach((r: BollingerResult) => {
                expect(r.upper as number).toBeGreaterThan(r.middle as number);
                expect(r.middle as number).toBeGreaterThan(r.lower as number);
            });
        });

        it('가격이 일정할 때 upper = middle = lower다', () => {
            const bars = makeBars(Array.from({ length: 50 }, () => 100));
            const result = calculateBollinger(bars);
            result.slice(period - 1).forEach((r: BollingerResult) => {
                expect(r.upper).toBeCloseTo(100, 10);
                expect(r.middle).toBeCloseTo(100, 10);
                expect(r.lower).toBeCloseTo(100, 10);
            });
        });

        it('기본값은 period=20, stdDev=2다', () => {
            const bars = makeBars(
                Array.from({ length: 50 }, (_, i) => 100 + i)
            );
            expect(calculateBollinger(bars)).toEqual(
                calculateBollinger(
                    bars,
                    BOLLINGER_DEFAULT_PERIOD,
                    BOLLINGER_DEFAULT_STD_DEV
                )
            );
        });
    });
});
