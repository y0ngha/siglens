import { calculateDonchianChannel } from '@/domain/indicators/donchianChannel';
import { DONCHIAN_DEFAULT_PERIOD } from '@/domain/indicators/constants';
import type { Bar, DonchianChannelResult } from '@/domain/types';

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

describe('calculateDonchianChannel', () => {
    describe('입력 배열이 비어있을 때', () => {
        it('빈 배열을 반환한다', () => {
            expect(calculateDonchianChannel([])).toEqual([]);
        });
    });

    describe('입력 배열 길이가 period 미만일 때', () => {
        it('전부 null인 배열을 반환한다', () => {
            const bars = makeUniformBars(10);
            const result = calculateDonchianChannel(bars);
            expect(result).toHaveLength(10);
            expect(
                result.every(
                    (r: DonchianChannelResult) =>
                        r.upper === null &&
                        r.middle === null &&
                        r.lower === null
                )
            ).toBe(true);
        });
    });

    describe('입력 배열 길이가 period 이상일 때', () => {
        const period = DONCHIAN_DEFAULT_PERIOD;

        it('입력과 동일한 길이의 배열을 반환한다', () => {
            const bars = makeUniformBars(30);
            expect(calculateDonchianChannel(bars)).toHaveLength(30);
        });

        it('처음 period - 1개의 값은 null이다', () => {
            const bars = makeUniformBars(30);
            const result = calculateDonchianChannel(bars);
            expect(
                result
                    .slice(0, period - 1)
                    .every(
                        (r: DonchianChannelResult) =>
                            r.upper === null &&
                            r.middle === null &&
                            r.lower === null
                    )
            ).toBe(true);
        });

        it('period - 1번째 이후 값은 null이 아닌 숫자다', () => {
            const bars = makeUniformBars(30);
            const result = calculateDonchianChannel(bars);
            result.slice(period - 1).forEach((r: DonchianChannelResult) => {
                expect(typeof r.upper).toBe('number');
                expect(typeof r.middle).toBe('number');
                expect(typeof r.lower).toBe('number');
            });
        });

        it('upper >= middle >= lower다', () => {
            const bars = makeBars(
                Array.from({ length: 30 }, (_, i) => ({
                    high: 110 + Math.sin(i) * 10,
                    low: 90 + Math.sin(i) * 10,
                    close: 100 + Math.sin(i) * 10,
                }))
            );
            const result = calculateDonchianChannel(bars);
            result.slice(period - 1).forEach((r: DonchianChannelResult) => {
                expect(r.upper as number).toBeGreaterThanOrEqual(
                    r.middle as number
                );
                expect(r.middle as number).toBeGreaterThanOrEqual(
                    r.lower as number
                );
            });
        });

        it('middle = (upper + lower) / 2다', () => {
            const bars = makeBars(
                Array.from({ length: 30 }, (_, i) => ({
                    high: 110 + i,
                    low: 90 + i,
                    close: 100 + i,
                }))
            );
            const result = calculateDonchianChannel(bars);
            result.slice(period - 1).forEach((r: DonchianChannelResult) => {
                expect(r.middle).toBeCloseTo(
                    ((r.upper as number) + (r.lower as number)) / 2,
                    10
                );
            });
        });

        it('가격이 일정할 때 upper = middle = lower다', () => {
            const bars = makeBars(
                Array.from({ length: 30 }, () => ({
                    high: 100,
                    low: 100,
                    close: 100,
                }))
            );
            const result = calculateDonchianChannel(bars);
            result.slice(period - 1).forEach((r: DonchianChannelResult) => {
                expect(r.upper).toBe(100);
                expect(r.middle).toBe(100);
                expect(r.lower).toBe(100);
            });
        });

        it('period 기본값은 DONCHIAN_DEFAULT_PERIOD다', () => {
            const bars = makeUniformBars(30);
            expect(calculateDonchianChannel(bars)).toEqual(
                calculateDonchianChannel(bars, DONCHIAN_DEFAULT_PERIOD)
            );
        });
    });
});
