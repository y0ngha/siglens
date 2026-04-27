import { calculateKeltnerChannel } from '@y0ngha/siglens-core';
import {
    KELTNER_ATR_PERIOD,
    KELTNER_EMA_PERIOD,
    KELTNER_MULTIPLIER,
} from '@y0ngha/siglens-core';
import type { Bar, KeltnerChannelResult } from '@y0ngha/siglens-core';

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

describe('calculateKeltnerChannel', () => {
    describe('입력 배열이 비어있을 때', () => {
        it('빈 배열을 반환한다', () => {
            expect(calculateKeltnerChannel([])).toEqual([]);
        });
    });

    describe('입력 배열 길이가 max(emaPeriod, atrPeriod) 미만일 때', () => {
        it('전부 null인 배열을 반환한다', () => {
            const bars = makeUniformBars(10);
            const result = calculateKeltnerChannel(bars);
            expect(result).toHaveLength(10);
            expect(
                result.every(
                    (r: KeltnerChannelResult) =>
                        r.upper === null &&
                        r.middle === null &&
                        r.lower === null
                )
            ).toBe(true);
        });
    });

    describe('입력 배열 길이가 충분할 때', () => {
        it('처음 max(emaPeriod-1, atrPeriod)개의 값은 null이다', () => {
            const bars = makeUniformBars(30);
            const result = calculateKeltnerChannel(bars);
            const nullCount = Math.max(
                KELTNER_EMA_PERIOD - 1,
                KELTNER_ATR_PERIOD
            );
            expect(
                result
                    .slice(0, nullCount)
                    .every(
                        (r: KeltnerChannelResult) =>
                            r.upper === null &&
                            r.middle === null &&
                            r.lower === null
                    )
            ).toBe(true);
        });

        it('입력과 동일한 길이의 배열을 반환한다', () => {
            const bars = makeUniformBars(30);
            expect(calculateKeltnerChannel(bars)).toHaveLength(30);
        });

        it('초기 null 영역 이후 값은 null이 아닌 숫자다', () => {
            const bars = makeUniformBars(30);
            const result = calculateKeltnerChannel(bars);
            const validResults = result.filter(
                (r: KeltnerChannelResult) => r.upper !== null
            );
            expect(validResults.length).toBeGreaterThan(0);
            validResults.forEach((r: KeltnerChannelResult) => {
                expect(typeof r.upper).toBe('number');
                expect(typeof r.middle).toBe('number');
                expect(typeof r.lower).toBe('number');
            });
        });

        it('upper > middle > lower다', () => {
            const bars = makeBars(
                Array.from({ length: 30 }, (_, i) => ({
                    high: 110 + Math.sin(i) * 10,
                    low: 90 + Math.sin(i) * 10,
                    close: 100 + Math.sin(i) * 10,
                }))
            );
            const result = calculateKeltnerChannel(bars);
            result
                .filter((r: KeltnerChannelResult) => r.upper !== null)
                .forEach((r: KeltnerChannelResult) => {
                    expect(r.upper as number).toBeGreaterThan(
                        r.middle as number
                    );
                    expect(r.middle as number).toBeGreaterThan(
                        r.lower as number
                    );
                });
        });

        it('upper - middle = middle - lower (대칭)다', () => {
            const bars = makeUniformBars(30);
            const result = calculateKeltnerChannel(bars);
            result
                .filter((r: KeltnerChannelResult) => r.upper !== null)
                .forEach((r: KeltnerChannelResult) => {
                    expect(
                        (r.upper as number) - (r.middle as number)
                    ).toBeCloseTo(
                        (r.middle as number) - (r.lower as number),
                        10
                    );
                });
        });

        it('기본값이 올바르다', () => {
            const bars = makeUniformBars(30);
            expect(calculateKeltnerChannel(bars)).toEqual(
                calculateKeltnerChannel(
                    bars,
                    KELTNER_EMA_PERIOD,
                    KELTNER_ATR_PERIOD,
                    KELTNER_MULTIPLIER
                )
            );
        });
    });
});
