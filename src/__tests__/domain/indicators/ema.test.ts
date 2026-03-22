import { calculateEMA, computeEMAValues } from '@/domain/indicators/ema';
import type { Bar } from '@/domain/types';

function makeBars(closes: number[]): Bar[] {
    return closes.map((close, i) => ({
        time: i,
        open: close,
        high: close,
        low: close,
        close,
        volume: 1000,
    }));
}

describe('computeEMAValues', () => {
    describe('입력 배열이 비어있을 때', () => {
        it('빈 배열을 반환한다', () => {
            expect(computeEMAValues([], 9)).toEqual([]);
        });
    });

    describe('period가 0 이하일 때', () => {
        it('빈 배열을 반환한다', () => {
            expect(computeEMAValues([100, 101, 102], 0)).toEqual([]);
        });
    });

    describe('입력 배열 길이가 period 미만일 때', () => {
        it('전부 null인 배열을 반환한다', () => {
            const result = computeEMAValues([100, 101, 102], 9);
            expect(result).toEqual([null, null, null]);
        });
    });

    describe('입력 배열 길이가 period와 같을 때', () => {
        it('마지막 값만 null이 아닌 배열을 반환한다', () => {
            const values = Array.from({ length: 9 }, (_, i) => 100 + i);
            const result = computeEMAValues(values, 9);
            expect(result).toHaveLength(9);
            expect(result.slice(0, 8).every(v => v === null)).toBe(true);
            expect(typeof result[8]).toBe('number');
        });
    });

    describe('입력 배열 길이가 period 이상일 때', () => {
        it('입력과 동일한 길이의 배열을 반환한다', () => {
            const values = Array.from({ length: 20 }, (_, i) => 100 + i);
            expect(computeEMAValues(values, 9)).toHaveLength(20);
        });

        it('처음 period - 1개의 값은 null이다', () => {
            const values = Array.from({ length: 20 }, (_, i) => 100 + i);
            const result = computeEMAValues(values, 9);
            expect(result.slice(0, 8).every(v => v === null)).toBe(true);
        });

        it('period번째 이후 값은 null이 아닌 숫자다', () => {
            const values = Array.from({ length: 20 }, (_, i) => 100 + i);
            const result = computeEMAValues(values, 9);
            expect(result.slice(8).every(v => typeof v === 'number')).toBe(
                true
            );
        });

        it('첫 번째 EMA 값은 초기 period개의 SMA와 같다', () => {
            const values = [10, 20, 30, 40, 50];
            const result = computeEMAValues(values, 5);
            const expectedSMA = (10 + 20 + 30 + 40 + 50) / 5;
            expect(result[4]).toBe(expectedSMA);
        });

        it('multiplier = 2 / (period + 1) 공식이 올바르게 적용된다', () => {
            const values = [10, 20, 30, 40, 50, 60];
            const period = 5;
            const result = computeEMAValues(values, period);
            const sma = (10 + 20 + 30 + 40 + 50) / 5;
            const multiplier = 2 / (period + 1);
            const expectedEMA = 60 * multiplier + sma * (1 - multiplier);
            expect(result[5]).toBeCloseTo(expectedEMA, 10);
        });

        it('가격이 일정할 때 EMA는 해당 가격과 같다', () => {
            const values = new Array(20).fill(100);
            const result = computeEMAValues(values, 9);
            result.slice(8).forEach(v => {
                expect(v).toBeCloseTo(100, 10);
            });
        });
    });
});

describe('calculateEMA', () => {
    describe('입력 배열이 비어있을 때', () => {
        it('빈 배열을 반환한다', () => {
            expect(calculateEMA([], 9)).toEqual([]);
        });
    });

    describe('입력 배열 길이가 period 미만일 때', () => {
        it('전부 null인 배열을 반환한다', () => {
            const bars = makeBars([100, 101, 102]);
            const result = calculateEMA(bars, 9);
            expect(result).toEqual([null, null, null]);
        });
    });

    describe('입력 배열 길이가 period와 같을 때', () => {
        it('마지막 값만 null이 아닌 배열을 반환한다', () => {
            const bars = makeBars(Array.from({ length: 9 }, (_, i) => 100 + i));
            const result = calculateEMA(bars, 9);
            expect(result).toHaveLength(9);
            expect(result.slice(0, 8).every(v => v === null)).toBe(true);
            expect(typeof result[8]).toBe('number');
        });
    });

    describe('입력 배열 길이가 period 이상일 때', () => {
        it('입력과 동일한 길이의 배열을 반환한다', () => {
            const bars = makeBars(
                Array.from({ length: 20 }, (_, i) => 100 + i)
            );
            const result = calculateEMA(bars, 9);
            expect(result).toHaveLength(20);
        });

        it('처음 period - 1개의 값은 null이다', () => {
            const bars = makeBars(
                Array.from({ length: 20 }, (_, i) => 100 + i)
            );
            const result = calculateEMA(bars, 9);
            expect(result.slice(0, 8).every(v => v === null)).toBe(true);
        });

        it('period번째 이후 값은 null이 아닌 숫자다', () => {
            const bars = makeBars(
                Array.from({ length: 20 }, (_, i) => 100 + i)
            );
            const result = calculateEMA(bars, 9);
            expect(result.slice(8).every(v => typeof v === 'number')).toBe(
                true
            );
        });

        it('반환값은 (number | null)[] 타입이다', () => {
            const bars = makeBars(
                Array.from({ length: 20 }, (_, i) => 100 + i)
            );
            const result = calculateEMA(bars, 9);
            result.forEach(v => {
                expect(v === null || typeof v === 'number').toBe(true);
            });
        });

        it('첫 번째 EMA 값은 초기 period개 close의 SMA와 같다', () => {
            const closes = [10, 20, 30, 40, 50];
            const bars = makeBars(closes);
            const result = calculateEMA(bars, 5);
            const expectedSMA = (10 + 20 + 30 + 40 + 50) / 5;
            expect(result[4]).toBe(expectedSMA);
        });

        it('multiplier = 2 / (period + 1) 공식이 올바르게 적용된다', () => {
            const closes = [10, 20, 30, 40, 50, 60];
            const bars = makeBars(closes);
            const period = 5;
            const result = calculateEMA(bars, period);

            const sma = (10 + 20 + 30 + 40 + 50) / 5;
            const multiplier = 2 / (period + 1);
            const expectedEMA = 60 * multiplier + sma * (1 - multiplier);

            expect(result[5]).toBeCloseTo(expectedEMA, 10);
        });

        it('가격이 일정할 때 EMA는 해당 가격과 같다', () => {
            const closes = new Array(20).fill(100);
            const bars = makeBars(closes);
            const result = calculateEMA(bars, 9);
            result.slice(8).forEach(v => {
                expect(v).toBeCloseTo(100, 10);
            });
        });
    });
});
