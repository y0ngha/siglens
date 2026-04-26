import { calculateSupertrend } from '@/domain/indicators/supertrend';
import {
    SUPERTREND_ATR_PERIOD,
    SUPERTREND_MULTIPLIER,
} from '@y0ngha/siglens-core';
import type { Bar, SupertrendResult } from '@/domain/types';

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

describe('calculateSupertrend', () => {
    describe('입력 배열이 비어있을 때', () => {
        it('빈 배열을 반환한다', () => {
            expect(calculateSupertrend([])).toEqual([]);
        });
    });

    describe('입력 배열 길이가 atrPeriod 이하일 때', () => {
        it('전부 null인 배열을 반환한다', () => {
            const bars = makeUniformBars(SUPERTREND_ATR_PERIOD);
            const result = calculateSupertrend(bars);
            expect(result).toHaveLength(SUPERTREND_ATR_PERIOD);
            expect(
                result.every(
                    (r: SupertrendResult) =>
                        r.supertrend === null && r.trend === null
                )
            ).toBe(true);
        });
    });

    describe('입력 배열 길이가 atrPeriod를 초과할 때', () => {
        it('입력과 동일한 길이의 배열을 반환한다', () => {
            const bars = makeUniformBars(20);
            expect(calculateSupertrend(bars)).toHaveLength(20);
        });

        it('처음 atrPeriod개의 값은 null이다', () => {
            const bars = makeUniformBars(20);
            const result = calculateSupertrend(bars);
            expect(
                result
                    .slice(0, SUPERTREND_ATR_PERIOD)
                    .every(
                        (r: SupertrendResult) =>
                            r.supertrend === null && r.trend === null
                    )
            ).toBe(true);
        });

        it('atrPeriod번째 이후 값은 supertrend와 trend가 존재한다', () => {
            const bars = makeUniformBars(20);
            const result = calculateSupertrend(bars);
            result
                .slice(SUPERTREND_ATR_PERIOD)
                .forEach((r: SupertrendResult) => {
                    expect(typeof r.supertrend).toBe('number');
                    expect(r.trend === 'up' || r.trend === 'down').toBe(true);
                });
        });

        it('상승 추세에서 supertrend는 가격 아래에 위치한다', () => {
            const bars = makeBars(
                Array.from({ length: 30 }, (_, i) => ({
                    high: 110 + i * 3,
                    low: 90 + i * 3,
                    close: 100 + i * 3,
                }))
            );
            const result = calculateSupertrend(bars);
            result
                .slice(SUPERTREND_ATR_PERIOD)
                .forEach((r: SupertrendResult, i) => {
                    if (r.trend === 'up') {
                        const barIdx = SUPERTREND_ATR_PERIOD + i;
                        expect(r.supertrend as number).toBeLessThan(
                            bars[barIdx].close
                        );
                    }
                });
        });

        it('첫 번째 유효 값이 명세와 일치한다', () => {
            // period=3, multiplier=3
            // TR 모두 4로 균일 → ATR=4
            // bars[3]: hl2=(16+12)/2=14, finalLowerBand=14-3*4=2, close(15)>hl2(14) → trend='up'
            const bars = makeBars([
                { high: 12, low: 8, close: 10 },
                { high: 13, low: 9, close: 11 },
                { high: 14, low: 10, close: 12 },
                { high: 16, low: 12, close: 15 },
                { high: 17, low: 13, close: 16 },
            ]);
            const result = calculateSupertrend(bars, 3, 3);
            expect(result[3].supertrend).toBeCloseTo(2, 5);
            expect(result[3].trend).toBe('up');
        });

        it('period 기본값은 SUPERTREND_ATR_PERIOD와 SUPERTREND_MULTIPLIER다', () => {
            const bars = makeUniformBars(20);
            expect(calculateSupertrend(bars)).toEqual(
                calculateSupertrend(
                    bars,
                    SUPERTREND_ATR_PERIOD,
                    SUPERTREND_MULTIPLIER
                )
            );
        });
    });
});
