import { calculateWilliamsR } from '@/domain/indicators/williamsR';
import { WILLIAMS_R_DEFAULT_PERIOD } from '@/domain/indicators/constants';
import type { Bar } from '@/domain/types';

function makeBars(
    values: { high: number; low: number; close: number }[]
): Bar[] {
    return values.map((v, i) => ({
        time: i,
        open: v.close,
        high: v.high,
        low: v.low,
        close: v.close,
        volume: 1000,
    }));
}

function makeUniformBars(count: number, price = 100): Bar[] {
    return makeBars(
        Array.from({ length: count }, () => ({
            high: price + 5,
            low: price - 5,
            close: price,
        }))
    );
}

describe('calculateWilliamsR', () => {
    describe('입력 배열이 비어있을 때', () => {
        it('빈 배열을 반환한다', () => {
            expect(calculateWilliamsR([])).toEqual([]);
        });
    });

    describe('입력 배열 길이가 period 미만일 때', () => {
        it('전부 null인 배열을 반환한다', () => {
            const bars = makeUniformBars(5);
            const result = calculateWilliamsR(bars);
            expect(result.every(v => v === null)).toBe(true);
        });
    });

    describe('입력 배열 길이가 period 이상일 때', () => {
        it('입력과 동일한 길이의 배열을 반환한다', () => {
            const bars = makeUniformBars(30);
            expect(calculateWilliamsR(bars)).toHaveLength(30);
        });

        it('처음 period - 1개의 값은 null이다', () => {
            const bars = makeUniformBars(30);
            const result = calculateWilliamsR(bars);
            expect(
                result
                    .slice(0, WILLIAMS_R_DEFAULT_PERIOD - 1)
                    .every(v => v === null)
            ).toBe(true);
        });

        it('period - 1번째 이후 값은 null이 아닌 숫자다', () => {
            const bars = makeUniformBars(30);
            const result = calculateWilliamsR(bars);
            expect(
                result
                    .slice(WILLIAMS_R_DEFAULT_PERIOD - 1)
                    .every(v => typeof v === 'number')
            ).toBe(true);
        });

        it('값은 -100 이상 0 이하다', () => {
            const bars = makeBars(
                Array.from({ length: 30 }, (_, i) => ({
                    high: 110 + Math.sin(i) * 5,
                    low: 90 + Math.sin(i) * 5,
                    close: 100 + Math.sin(i) * 5,
                }))
            );
            const result = calculateWilliamsR(bars);
            result.slice(WILLIAMS_R_DEFAULT_PERIOD - 1).forEach(v => {
                expect(v).toBeGreaterThanOrEqual(-100);
                expect(v).toBeLessThanOrEqual(0);
            });
        });

        it('HH와 LL이 같을 때 -50을 반환한다', () => {
            const bars = makeBars(
                Array.from({ length: 20 }, () => ({
                    high: 100,
                    low: 100,
                    close: 100,
                }))
            );
            const result = calculateWilliamsR(bars);
            expect(result[WILLIAMS_R_DEFAULT_PERIOD - 1]).toBe(-50);
        });

        it('종가가 최고가일 때 0을 반환한다', () => {
            const period = 3;
            const bars = makeBars([
                { high: 105, low: 95, close: 100 },
                { high: 110, low: 96, close: 108 },
                { high: 110, low: 97, close: 110 },
            ]);
            const result = calculateWilliamsR(bars, period);
            expect(result[period - 1]).toBeCloseTo(0, 10);
        });

        it('종가가 최저가일 때 -100을 반환한다', () => {
            const period = 3;
            const bars = makeBars([
                { high: 105, low: 95, close: 100 },
                { high: 110, low: 96, close: 98 },
                { high: 108, low: 95, close: 95 },
            ]);
            const result = calculateWilliamsR(bars, period);
            expect(result[period - 1]).toBeCloseTo(-100, 10);
        });

        it('period 기본값은 WILLIAMS_R_DEFAULT_PERIOD다', () => {
            const bars = makeUniformBars(30);
            expect(calculateWilliamsR(bars)).toEqual(
                calculateWilliamsR(bars, WILLIAMS_R_DEFAULT_PERIOD)
            );
        });
    });
});
