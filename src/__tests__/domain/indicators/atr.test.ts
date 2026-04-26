import { calculateATR } from '@/domain/indicators/atr';
import { ATR_DEFAULT_PERIOD } from '@y0ngha/siglens-core';
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
            high: price + 1,
            low: price - 1,
            close: price,
        }))
    );
}

describe('calculateATR', () => {
    describe('입력 배열이 비어있을 때', () => {
        it('빈 배열을 반환한다', () => {
            expect(calculateATR([])).toEqual([]);
        });
    });

    describe('입력 배열 길이가 period 이하일 때', () => {
        it('전부 null인 배열을 반환한다', () => {
            const bars = makeUniformBars(ATR_DEFAULT_PERIOD);
            const result = calculateATR(bars);
            expect(result).toHaveLength(ATR_DEFAULT_PERIOD);
            expect(result.every(v => v === null)).toBe(true);
        });
    });

    describe('입력 배열 길이가 period를 초과할 때', () => {
        it('입력과 동일한 길이의 배열을 반환한다', () => {
            const bars = makeUniformBars(30);
            expect(calculateATR(bars)).toHaveLength(30);
        });

        it('처음 period개의 값은 null이다', () => {
            const bars = makeUniformBars(30);
            const result = calculateATR(bars);
            expect(
                result.slice(0, ATR_DEFAULT_PERIOD).every(v => v === null)
            ).toBe(true);
        });

        it('period번째 이후 값은 null이 아닌 숫자다', () => {
            const bars = makeUniformBars(30);
            const result = calculateATR(bars);
            expect(
                result
                    .slice(ATR_DEFAULT_PERIOD)
                    .every(v => typeof v === 'number')
            ).toBe(true);
        });

        it('ATR 값은 0 이상이다', () => {
            const bars = makeBars(
                Array.from({ length: 30 }, (_, i) => ({
                    high: 110 + Math.sin(i) * 5,
                    low: 90 + Math.sin(i) * 5,
                    close: 100 + Math.sin(i) * 5,
                }))
            );
            const result = calculateATR(bars);
            result.slice(ATR_DEFAULT_PERIOD).forEach(v => {
                expect(v).toBeGreaterThanOrEqual(0);
            });
        });

        it('Wilder smoothing이 올바르게 적용된다', () => {
            const period = 3;
            const bars = makeBars([
                { high: 48, low: 44, close: 46 },
                { high: 49, low: 45, close: 47 },
                { high: 50, low: 43, close: 48 },
                { high: 47, low: 42, close: 45 },
                { high: 51, low: 44, close: 49 },
            ]);
            // TR[0]: N/A (no previous bar)
            // TR[1]: max(49-45, |49-46|, |45-46|) = max(4, 3, 1) = 4
            // TR[2]: max(50-43, |50-47|, |43-47|) = max(7, 3, 4) = 7
            // TR[3]: max(47-42, |47-48|, |42-48|) = max(5, 1, 6) = 6
            // TR[4]: max(51-44, |51-45|, |44-45|) = max(7, 6, 1) = 7
            // initialATR = (4 + 7 + 6) / 3 = 17/3 ≈ 5.6667
            // ATR[4] = (5.6667 * 2 + 7) / 3 = 18.3333 / 3 ≈ 6.1111
            const result = calculateATR(bars, period);
            expect(result[period]).toBeCloseTo(17 / 3, 4);
            expect(result[period + 1]).toBeCloseTo(((17 / 3) * 2 + 7) / 3, 4);
        });

        it('period 기본값은 ATR_DEFAULT_PERIOD다', () => {
            const bars = makeUniformBars(30);
            expect(calculateATR(bars)).toEqual(
                calculateATR(bars, ATR_DEFAULT_PERIOD)
            );
        });

        it('가격이 일정할 때 ATR은 일정한 범위를 유지한다', () => {
            const bars = makeUniformBars(30);
            const result = calculateATR(bars);
            const nonNullValues = result.filter((v): v is number => v !== null);
            const first = nonNullValues[0];
            nonNullValues.forEach(v => {
                expect(v).toBeCloseTo(first, 10);
            });
        });
    });
});
