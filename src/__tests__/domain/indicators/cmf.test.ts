import { calculateCMF } from '@/domain/indicators/cmf';
import { CMF_DEFAULT_PERIOD } from '@y0ngha/siglens-core';
import type { Bar } from '@/domain/types';

function makeBars(
    values: { high: number; low: number; close: number; volume: number }[]
): Bar[] {
    return values.map((v, i) => ({
        time: i,
        open: v.close,
        high: v.high,
        low: v.low,
        close: v.close,
        volume: v.volume,
    }));
}

function makeUniformBars(count: number, price = 100): Bar[] {
    return makeBars(
        Array.from({ length: count }, () => ({
            high: price + 5,
            low: price - 5,
            close: price,
            volume: 1000,
        }))
    );
}

describe('calculateCMF', () => {
    describe('입력 배열이 비어있을 때', () => {
        it('빈 배열을 반환한다', () => {
            expect(calculateCMF([])).toEqual([]);
        });
    });

    describe('입력 배열 길이가 period 미만일 때', () => {
        it('전부 null인 배열을 반환한다', () => {
            const bars = makeUniformBars(10);
            const result = calculateCMF(bars);
            expect(result.every(v => v === null)).toBe(true);
        });
    });

    describe('입력 배열 길이가 period 이상일 때', () => {
        it('입력과 동일한 길이의 배열을 반환한다', () => {
            const bars = makeUniformBars(30);
            expect(calculateCMF(bars)).toHaveLength(30);
        });

        it('처음 period - 1개의 값은 null이다', () => {
            const bars = makeUniformBars(30);
            const result = calculateCMF(bars);
            expect(
                result.slice(0, CMF_DEFAULT_PERIOD - 1).every(v => v === null)
            ).toBe(true);
        });

        it('period - 1번째 이후 값은 null이 아닌 숫자다', () => {
            const bars = makeUniformBars(30);
            const result = calculateCMF(bars);
            expect(
                result
                    .slice(CMF_DEFAULT_PERIOD - 1)
                    .every(v => typeof v === 'number')
            ).toBe(true);
        });

        it('값은 -1 이상 +1 이하다', () => {
            const bars = makeBars(
                Array.from({ length: 30 }, (_, i) => ({
                    high: 110 + Math.sin(i) * 10,
                    low: 90 + Math.sin(i) * 10,
                    close: 100 + Math.sin(i) * 10,
                    volume: 1000 + i * 100,
                }))
            );
            const result = calculateCMF(bars);
            result.slice(CMF_DEFAULT_PERIOD - 1).forEach(v => {
                expect(v).toBeGreaterThanOrEqual(-1);
                expect(v).toBeLessThanOrEqual(1);
            });
        });

        it('High와 Low가 같을 때 CLV는 0이다', () => {
            const period = 3;
            const bars = makeBars(
                Array.from({ length: 5 }, () => ({
                    high: 100,
                    low: 100,
                    close: 100,
                    volume: 1000,
                }))
            );
            const result = calculateCMF(bars, period);
            expect(result[period - 1]).toBe(0);
        });

        it('종가가 항상 최고가일 때 CMF는 +1이다', () => {
            const period = 3;
            const bars = makeBars(
                Array.from({ length: 5 }, () => ({
                    high: 110,
                    low: 90,
                    close: 110,
                    volume: 1000,
                }))
            );
            const result = calculateCMF(bars, period);
            expect(result[period - 1]).toBeCloseTo(1, 10);
        });

        it('종가가 항상 최저가일 때 CMF는 -1이다', () => {
            const period = 3;
            const bars = makeBars(
                Array.from({ length: 5 }, () => ({
                    high: 110,
                    low: 90,
                    close: 90,
                    volume: 1000,
                }))
            );
            const result = calculateCMF(bars, period);
            expect(result[period - 1]).toBeCloseTo(-1, 10);
        });

        it('period 기본값은 CMF_DEFAULT_PERIOD다', () => {
            const bars = makeUniformBars(30);
            expect(calculateCMF(bars)).toEqual(
                calculateCMF(bars, CMF_DEFAULT_PERIOD)
            );
        });
    });
});
