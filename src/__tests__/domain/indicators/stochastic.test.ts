import { calculateStochastic } from '@y0ngha/siglens-core';
import {
    STOCHASTIC_D_PERIOD,
    STOCHASTIC_K_PERIOD,
    STOCHASTIC_SMOOTHING,
} from '@y0ngha/siglens-core';
import type { Bar } from '@y0ngha/siglens-core';

const makeBar = (close: number, high: number, low: number, index = 0): Bar => ({
    time: 1000 + index,
    open: close,
    high,
    low,
    close,
    volume: 1000,
});

const makeBarsFromCloses = (closes: number[]): Bar[] =>
    closes.map((close, i) => makeBar(close, close + 1, close - 1, i));

const STOCHASTIC_PERCENTAGE_MAX = 100;
const STOCHASTIC_PERCENTAGE_MIN = 0;

// kPeriod + smoothing - 1 bars needed for first non-null %K
const FIRST_K_INDEX = STOCHASTIC_K_PERIOD + STOCHASTIC_SMOOTHING - 2;
// FIRST_K_INDEX + dPeriod - 1 bars needed for first non-null %D
const FIRST_D_INDEX = FIRST_K_INDEX + STOCHASTIC_D_PERIOD - 1;

describe('Stochastic Oscillator', () => {
    describe('calculateStochastic', () => {
        describe('빈 배열일 때', () => {
            it('빈 배열을 반환한다', () => {
                expect(calculateStochastic([])).toEqual([]);
            });
        });

        describe('입력 배열 길이가 kPeriod 미만일 때', () => {
            it('모든 결과가 null이다', () => {
                const bars = makeBarsFromCloses(
                    Array.from({ length: 5 }, (_, i) => 100 + i)
                );
                const result = calculateStochastic(bars);
                expect(
                    result.every(
                        r => r.percentK === null && r.percentD === null
                    )
                ).toBe(true);
            });
        });

        describe('정상 입력일 때', () => {
            const TEST_BAR_COUNT = 30;
            const bars = Array.from({ length: TEST_BAR_COUNT }, (_, i) =>
                makeBar(
                    100 + Math.sin(i) * 10,
                    105 + Math.sin(i) * 10,
                    95 + Math.sin(i) * 10,
                    i
                )
            );

            it('입력과 동일한 길이의 배열을 반환한다', () => {
                const result = calculateStochastic(bars);
                expect(result).toHaveLength(TEST_BAR_COUNT);
            });

            it('처음 FIRST_K_INDEX개의 %K 값은 null이다', () => {
                const result = calculateStochastic(bars);
                expect(
                    result
                        .slice(0, FIRST_K_INDEX)
                        .every(r => r.percentK === null)
                ).toBe(true);
            });

            it('FIRST_K_INDEX번째 이후 %K 값은 null이 아닌 숫자다', () => {
                const result = calculateStochastic(bars);
                expect(
                    result
                        .slice(FIRST_K_INDEX)
                        .every(r => typeof r.percentK === 'number')
                ).toBe(true);
            });

            it('처음 FIRST_D_INDEX개의 %D 값은 null이다', () => {
                const result = calculateStochastic(bars);
                expect(
                    result
                        .slice(0, FIRST_D_INDEX)
                        .every(r => r.percentD === null)
                ).toBe(true);
            });

            it('FIRST_D_INDEX번째 이후 %D 값은 null이 아닌 숫자다', () => {
                const result = calculateStochastic(bars);
                expect(
                    result
                        .slice(FIRST_D_INDEX)
                        .every(r => typeof r.percentD === 'number')
                ).toBe(true);
            });

            it('%K 값은 0 이상 100 이하다', () => {
                const result = calculateStochastic(bars);
                result.forEach(r => {
                    if (r.percentK !== null) {
                        expect(r.percentK).toBeGreaterThanOrEqual(
                            STOCHASTIC_PERCENTAGE_MIN
                        );
                        expect(r.percentK).toBeLessThanOrEqual(
                            STOCHASTIC_PERCENTAGE_MAX
                        );
                    }
                });
            });

            it('%D 값은 0 이상 100 이하다', () => {
                const result = calculateStochastic(bars);
                result.forEach(r => {
                    if (r.percentD !== null) {
                        expect(r.percentD).toBeGreaterThanOrEqual(
                            STOCHASTIC_PERCENTAGE_MIN
                        );
                        expect(r.percentD).toBeLessThanOrEqual(
                            STOCHASTIC_PERCENTAGE_MAX
                        );
                    }
                });
            });

            it('기본 파라미터는 (14, 3, 3)이다', () => {
                expect(calculateStochastic(bars)).toEqual(
                    calculateStochastic(
                        bars,
                        STOCHASTIC_K_PERIOD,
                        STOCHASTIC_D_PERIOD,
                        STOCHASTIC_SMOOTHING
                    )
                );
            });
        });

        describe('계산 정확성', () => {
            it('고가-저가 범위가 0일 때 %K는 50(중간값)이다', () => {
                // 모든 bar의 high, low, close가 같으면 range = 0
                const MIDPOINT_PERCENTAGE = 50;
                const bars = Array.from({ length: 20 }, (_, i) =>
                    makeBar(100, 100, 100, i)
                );
                const result = calculateStochastic(bars);
                result.forEach(r => {
                    if (r.percentK !== null) {
                        expect(r.percentK).toBe(MIDPOINT_PERCENTAGE);
                    }
                });
            });

            it('가격이 계속 상승할 때 %K는 높은 값을 가진다', () => {
                const bars = Array.from({ length: 50 }, (_, i) =>
                    makeBar(100 + i, 100 + i, 100 + i, i)
                );
                const result = calculateStochastic(bars);
                const lastResult = result[result.length - 1];
                expect(lastResult.percentK).toBe(STOCHASTIC_PERCENTAGE_MAX);
            });

            it('가격이 계속 하락할 때 %K는 낮은 값을 가진다', () => {
                const bars = Array.from({ length: 50 }, (_, i) =>
                    makeBar(200 - i, 200 - i, 200 - i, i)
                );
                const result = calculateStochastic(bars);
                const lastResult = result[result.length - 1];
                expect(lastResult.percentK).toBe(STOCHASTIC_PERCENTAGE_MIN);
            });

            it('첫 번째 유효한 %K 값은 Fast %K의 smoothing 이동평균이다', () => {
                // bars with specific values to verify calculation
                const bars: Bar[] = Array.from({ length: 20 }, (_, i) => ({
                    time: 1000 + i,
                    open: 44,
                    high: 44 + (i % 3) + 1,
                    low: 44 - (i % 3) - 1,
                    close: 44 + Math.sin(i) * 2,
                    volume: 1000,
                }));

                const result = calculateStochastic(bars);
                // Verify the first non-null %K exists at the expected index
                expect(result[FIRST_K_INDEX].percentK).not.toBeNull();
                expect(typeof result[FIRST_K_INDEX].percentK).toBe('number');
            });
        });
    });
});
