import { calculateMFI } from '@/domain/indicators/mfi';
import { MFI_DEFAULT_PERIOD } from '@/domain/indicators/constants';
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

describe('calculateMFI', () => {
    describe('입력 배열이 비어있을 때', () => {
        it('빈 배열을 반환한다', () => {
            expect(calculateMFI([])).toEqual([]);
        });
    });

    describe('입력 배열 길이가 period 이하일 때', () => {
        it('전부 null인 배열을 반환한다', () => {
            const bars = makeUniformBars(MFI_DEFAULT_PERIOD);
            const result = calculateMFI(bars);
            expect(result).toHaveLength(MFI_DEFAULT_PERIOD);
            expect(result.every(v => v === null)).toBe(true);
        });
    });

    describe('입력 배열 길이가 period를 초과할 때', () => {
        it('입력과 동일한 길이의 배열을 반환한다', () => {
            const bars = makeUniformBars(30);
            expect(calculateMFI(bars)).toHaveLength(30);
        });

        it('처음 period개의 값은 null이다', () => {
            const bars = makeUniformBars(30);
            const result = calculateMFI(bars);
            expect(
                result.slice(0, MFI_DEFAULT_PERIOD).every(v => v === null)
            ).toBe(true);
        });

        it('period번째 이후 값은 null이 아닌 숫자다', () => {
            const bars = makeBars(
                Array.from({ length: 30 }, (_, i) => ({
                    high: 110 + i,
                    low: 90 + i,
                    close: 100 + i,
                    volume: 1000,
                }))
            );
            const result = calculateMFI(bars);
            expect(
                result
                    .slice(MFI_DEFAULT_PERIOD)
                    .every(v => typeof v === 'number')
            ).toBe(true);
        });

        it('값은 0 이상 100 이하다', () => {
            const bars = makeBars(
                Array.from({ length: 30 }, (_, i) => ({
                    high: 110 + Math.sin(i) * 10,
                    low: 90 + Math.sin(i) * 10,
                    close: 100 + Math.sin(i) * 10,
                    volume: 1000 + i * 100,
                }))
            );
            const result = calculateMFI(bars);
            result.slice(MFI_DEFAULT_PERIOD).forEach(v => {
                expect(v).toBeGreaterThanOrEqual(0);
                expect(v).toBeLessThanOrEqual(100);
            });
        });

        it('모든 TP가 상승할 때 MFI는 100이다', () => {
            const bars = makeBars(
                Array.from({ length: 20 }, (_, i) => ({
                    high: 110 + i * 2,
                    low: 90 + i * 2,
                    close: 100 + i * 2,
                    volume: 1000,
                }))
            );
            const result = calculateMFI(bars);
            expect(result[MFI_DEFAULT_PERIOD]).toBe(100);
        });

        it('period 기본값은 MFI_DEFAULT_PERIOD다', () => {
            const bars = makeUniformBars(30);
            expect(calculateMFI(bars)).toEqual(
                calculateMFI(bars, MFI_DEFAULT_PERIOD)
            );
        });
    });
});
