import { calculateMA } from '@y0ngha/siglens-core';
import type { Bar } from '@y0ngha/siglens-core';

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

describe('calculateMA', () => {
    describe('입력 배열이 비어있을 때', () => {
        it('빈 배열을 반환한다', () => {
            expect(calculateMA([], 20)).toEqual([]);
        });
    });

    describe('period가 0 이하일 때', () => {
        it('빈 배열을 반환한다', () => {
            const bars = makeBars([100, 101, 102]);
            expect(calculateMA(bars, 0)).toEqual([]);
            expect(calculateMA(bars, -1)).toEqual([]);
        });
    });

    describe('입력 배열 길이가 period 미만일 때', () => {
        it('전부 null인 배열을 반환한다', () => {
            const bars = makeBars([100, 101, 102]);
            const result = calculateMA(bars, 20);
            expect(result).toEqual([null, null, null]);
        });
    });

    describe('입력 배열 길이가 period와 같을 때', () => {
        it('마지막 값만 null이 아닌 배열을 반환한다', () => {
            const bars = makeBars(
                Array.from({ length: 20 }, (_, i) => 100 + i)
            );
            const result = calculateMA(bars, 20);
            expect(result).toHaveLength(20);
            expect(result.slice(0, 19).every(v => v === null)).toBe(true);
            expect(typeof result[19]).toBe('number');
        });
    });

    describe('입력 배열 길이가 period 이상일 때', () => {
        it('입력과 동일한 길이의 배열을 반환한다', () => {
            const bars = makeBars(
                Array.from({ length: 30 }, (_, i) => 100 + i)
            );
            const result = calculateMA(bars, 20);
            expect(result).toHaveLength(30);
        });

        it('처음 period - 1개의 값은 null이다', () => {
            const bars = makeBars(
                Array.from({ length: 30 }, (_, i) => 100 + i)
            );
            const result = calculateMA(bars, 20);
            expect(result.slice(0, 19).every(v => v === null)).toBe(true);
        });

        it('period번째 이후 값은 null이 아닌 숫자다', () => {
            const bars = makeBars(
                Array.from({ length: 30 }, (_, i) => 100 + i)
            );
            const result = calculateMA(bars, 20);
            expect(result.slice(19).every(v => typeof v === 'number')).toBe(
                true
            );
        });

        it('반환값은 (number | null)[] 타입이다', () => {
            const bars = makeBars(
                Array.from({ length: 30 }, (_, i) => 100 + i)
            );
            const result = calculateMA(bars, 20);
            result.forEach(v => {
                expect(v === null || typeof v === 'number').toBe(true);
            });
        });

        it('첫 번째 MA 값은 초기 period개 close의 단순 평균과 같다', () => {
            const closes = [10, 20, 30, 40, 50];
            const bars = makeBars(closes);
            const result = calculateMA(bars, 5);
            const expectedSMA = (10 + 20 + 30 + 40 + 50) / 5;
            expect(result[4]).toBe(expectedSMA);
        });

        it('슬라이딩 윈도우가 올바르게 이동한다', () => {
            const closes = [10, 20, 30, 40, 50, 60];
            const bars = makeBars(closes);
            const result = calculateMA(bars, 3);

            expect(result[2]).toBeCloseTo((10 + 20 + 30) / 3, 10);
            expect(result[3]).toBeCloseTo((20 + 30 + 40) / 3, 10);
            expect(result[4]).toBeCloseTo((30 + 40 + 50) / 3, 10);
            expect(result[5]).toBeCloseTo((40 + 50 + 60) / 3, 10);
        });

        it('가격이 일정할 때 MA는 해당 가격과 같다', () => {
            const closes = new Array(30).fill(100);
            const bars = makeBars(closes);
            const result = calculateMA(bars, 20);
            result.slice(19).forEach(v => {
                expect(v).toBe(100);
            });
        });

        it('기간 5, 10, 20, 60, 120, 200을 지원한다', () => {
            const bars = makeBars(
                Array.from({ length: 200 }, (_, i) => 100 + i)
            );
            [5, 10, 20, 60, 120, 200].forEach(period => {
                const result = calculateMA(bars, period);
                expect(result).toHaveLength(200);
                expect(result.slice(0, period - 1).every(v => v === null)).toBe(
                    true
                );
                expect(
                    result.slice(period - 1).every(v => typeof v === 'number')
                ).toBe(true);
            });
        });
    });
});
