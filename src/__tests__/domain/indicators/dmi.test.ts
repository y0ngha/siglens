import { calculateDMI } from '@/domain/indicators/dmi';
import { DMI_DEFAULT_PERIOD } from '@/domain/indicators/constants';
import type { Bar, DMIResult } from '@/domain/types';

function makeBars(
    values: { high: number; low: number; close: number }[]
): Bar[] {
    return values.map((v, i) => ({
        time: i,
        open: v.close,
        high: v.high,
        low: v.low,
        close: v.close,
        volume: 1,
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

const NULL_RESULT: DMIResult = { diPlus: null, diMinus: null, adx: null };

describe('calculateDMI', () => {
    describe('입력 배열이 비어있을 때', () => {
        it('빈 배열을 반환한다', () => {
            expect(calculateDMI([])).toEqual([]);
        });
    });

    describe('입력 배열 길이가 period * 2 미만일 때', () => {
        it('전부 null인 배열을 반환한다', () => {
            const bars = makeUniformBars(DMI_DEFAULT_PERIOD * 2 - 1);
            const result = calculateDMI(bars);
            expect(result).toHaveLength(bars.length);
            expect(
                result.every(
                    r =>
                        r.diPlus === null &&
                        r.diMinus === null &&
                        r.adx === null
                )
            ).toBe(true);
        });
    });

    describe('입력 배열 길이가 period * 2 이상일 때', () => {
        const period = DMI_DEFAULT_PERIOD;
        const barCount = 60;

        it('입력과 동일한 길이의 배열을 반환한다', () => {
            const bars = makeUniformBars(barCount);
            expect(calculateDMI(bars)).toHaveLength(barCount);
        });

        it('처음 period * 2 - 1개의 값은 null이다', () => {
            const bars = makeUniformBars(barCount);
            const result = calculateDMI(bars);
            expect(
                result
                    .slice(0, period * 2 - 1)
                    .every(
                        r =>
                            r.diPlus === null &&
                            r.diMinus === null &&
                            r.adx === null
                    )
            ).toBe(true);
        });

        it('period * 2 - 1번째 이후 값은 null이 아닌 숫자다', () => {
            const bars = makeUniformBars(barCount);
            const result = calculateDMI(bars);
            result.slice(period * 2 - 1).forEach(r => {
                expect(typeof r.diPlus).toBe('number');
                expect(typeof r.diMinus).toBe('number');
                expect(typeof r.adx).toBe('number');
            });
        });

        it('+DI, -DI 값은 0 이상이다', () => {
            const bars = makeBars(
                Array.from({ length: barCount }, (_, i) => ({
                    high: 100 + i,
                    low: 90 + i,
                    close: 95 + i,
                }))
            );
            const result = calculateDMI(bars);
            result.slice(period * 2 - 1).forEach(r => {
                expect(r.diPlus as number).toBeGreaterThanOrEqual(0);
                expect(r.diMinus as number).toBeGreaterThanOrEqual(0);
            });
        });

        it('ADX 값은 0 이상 100 이하다', () => {
            const bars = makeBars(
                Array.from({ length: barCount }, (_, i) => ({
                    high: 100 + Math.sin(i) * 5,
                    low: 90 + Math.sin(i) * 5,
                    close: 95 + Math.sin(i) * 5,
                }))
            );
            const result = calculateDMI(bars);
            result.slice(period * 2 - 1).forEach(r => {
                expect(r.adx as number).toBeGreaterThanOrEqual(0);
                expect(r.adx as number).toBeLessThanOrEqual(100);
            });
        });

        it('가격이 일정하게 상승할 때 +DI > -DI다', () => {
            const bars = makeBars(
                Array.from({ length: barCount }, (_, i) => ({
                    high: 100 + i,
                    low: 90 + i,
                    close: 95 + i,
                }))
            );
            const result = calculateDMI(bars);
            result.slice(period * 2 - 1).forEach(r => {
                expect(r.diPlus as number).toBeGreaterThan(r.diMinus as number);
            });
        });

        it('가격이 일정하게 하락할 때 -DI > +DI다', () => {
            const bars = makeBars(
                Array.from({ length: barCount }, (_, i) => ({
                    high: 200 - i,
                    low: 190 - i,
                    close: 195 - i,
                }))
            );
            const result = calculateDMI(bars);
            result.slice(period * 2 - 1).forEach(r => {
                expect(r.diMinus as number).toBeGreaterThan(r.diPlus as number);
            });
        });

        it('기본값은 period=14다', () => {
            const bars = makeUniformBars(barCount);
            expect(calculateDMI(bars)).toEqual(
                calculateDMI(bars, DMI_DEFAULT_PERIOD)
            );
        });

        it('첫 번째 유효값 인덱스는 period * 2 - 1이다', () => {
            const bars = makeUniformBars(barCount);
            const result = calculateDMI(bars);
            expect(result[period * 2 - 2]).toEqual(NULL_RESULT);
            expect(result[period * 2 - 1].diPlus).not.toBeNull();
            expect(result[period * 2 - 1].diMinus).not.toBeNull();
            expect(result[period * 2 - 1].adx).not.toBeNull();
        });
    });
});
