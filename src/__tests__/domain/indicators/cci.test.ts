import { calculateCCI } from '@/domain/indicators/cci';
import {
    CCI_DEFAULT_PERIOD,
    CCI_NORMALIZATION_CONSTANT,
} from '@/domain/indicators/constants';
import type { Bar } from '@/domain/types';

const TYPICAL_PRICE_DIVISOR = 3;

const makeBars = (count: number, startPrice = 100): Bar[] =>
    Array.from({ length: count }, (_, i) => ({
        time: 1000 + i,
        open: startPrice + i,
        high: startPrice + i + 1,
        low: startPrice + i - 1,
        close: startPrice + i,
        volume: 1000,
    }));

describe('calculateCCI', () => {
    describe('입력 배열이 비어있을 때', () => {
        it('빈 배열을 반환한다', () => {
            expect(calculateCCI([])).toEqual([]);
        });
    });

    describe('입력 배열 길이가 period 미만일 때', () => {
        it('전부 null인 배열을 반환한다', () => {
            const bars = makeBars(5);
            const result = calculateCCI(bars, CCI_DEFAULT_PERIOD);
            expect(result.every(v => v === null)).toBe(true);
        });
    });

    describe('입력 배열 길이가 period와 같을 때', () => {
        it('처음 period - 1개의 값은 null이고 마지막 값은 숫자다', () => {
            const bars = makeBars(CCI_DEFAULT_PERIOD);
            const result = calculateCCI(bars, CCI_DEFAULT_PERIOD);
            expect(result).toHaveLength(CCI_DEFAULT_PERIOD);
            expect(
                result.slice(0, CCI_DEFAULT_PERIOD - 1).every(v => v === null)
            ).toBe(true);
            expect(typeof result[CCI_DEFAULT_PERIOD - 1]).toBe('number');
        });
    });

    describe('입력 배열 길이가 period를 초과할 때', () => {
        const TEST_BAR_COUNT = 30;

        it('입력과 동일한 길이의 배열을 반환한다', () => {
            const bars = makeBars(TEST_BAR_COUNT);
            const result = calculateCCI(bars, CCI_DEFAULT_PERIOD);
            expect(result).toHaveLength(TEST_BAR_COUNT);
        });

        it('처음 period - 1개의 값은 null이다', () => {
            const bars = makeBars(TEST_BAR_COUNT);
            const result = calculateCCI(bars, CCI_DEFAULT_PERIOD);
            expect(
                result.slice(0, CCI_DEFAULT_PERIOD - 1).every(v => v === null)
            ).toBe(true);
        });

        it('period - 1번째 이후 값은 null이 아닌 숫자다', () => {
            const bars = makeBars(TEST_BAR_COUNT);
            const result = calculateCCI(bars, CCI_DEFAULT_PERIOD);
            expect(
                result
                    .slice(CCI_DEFAULT_PERIOD - 1)
                    .every(v => typeof v === 'number')
            ).toBe(true);
        });

        it('period 기본값은 CCI_DEFAULT_PERIOD다', () => {
            const bars = makeBars(TEST_BAR_COUNT);
            expect(calculateCCI(bars)).toEqual(
                calculateCCI(bars, CCI_DEFAULT_PERIOD)
            );
        });

        it('모든 가격이 동일할 때 CCI는 0이다', () => {
            const CONSTANT_PRICE = 50;
            const bars: Bar[] = Array.from(
                { length: TEST_BAR_COUNT },
                (_, i) => ({
                    time: 1000 + i,
                    open: CONSTANT_PRICE,
                    high: CONSTANT_PRICE,
                    low: CONSTANT_PRICE,
                    close: CONSTANT_PRICE,
                    volume: 1000,
                })
            );
            const result = calculateCCI(bars, CCI_DEFAULT_PERIOD);
            result.slice(CCI_DEFAULT_PERIOD - 1).forEach(v => {
                expect(v).toBe(0);
            });
        });

        it('첫 번째 유효값이 CCI 공식과 일치한다', () => {
            const SMALL_PERIOD = 3;
            const bars: Bar[] = [
                {
                    time: 1000,
                    open: 10,
                    high: 12,
                    low: 8,
                    close: 11,
                    volume: 100,
                },
                {
                    time: 1001,
                    open: 11,
                    high: 14,
                    low: 9,
                    close: 13,
                    volume: 100,
                },
                {
                    time: 1002,
                    open: 13,
                    high: 16,
                    low: 10,
                    close: 15,
                    volume: 100,
                },
            ];

            const tp0 = (12 + 8 + 11) / TYPICAL_PRICE_DIVISOR;
            const tp1 = (14 + 9 + 13) / TYPICAL_PRICE_DIVISOR;
            const tp2 = (16 + 10 + 15) / TYPICAL_PRICE_DIVISOR;
            const sma = (tp0 + tp1 + tp2) / SMALL_PERIOD;
            const md =
                (Math.abs(tp0 - sma) +
                    Math.abs(tp1 - sma) +
                    Math.abs(tp2 - sma)) /
                SMALL_PERIOD;
            const expectedCCI = (tp2 - sma) / (CCI_NORMALIZATION_CONSTANT * md);

            const result = calculateCCI(bars, SMALL_PERIOD);
            expect(result[SMALL_PERIOD - 1]).toBeCloseTo(expectedCCI, 6);
        });
    });
});
