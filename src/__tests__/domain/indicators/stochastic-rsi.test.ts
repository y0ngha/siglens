import { calculateStochRSI } from '@y0ngha/siglens-core';
import {
    STOCH_RSI_D_PERIOD,
    STOCH_RSI_K_PERIOD,
    STOCH_RSI_RSI_PERIOD,
    STOCH_RSI_STOCH_PERIOD,
} from '@y0ngha/siglens-core';

// First non-null K index: rsiPeriod + stochPeriod - 1 + kSmoothing - 1
const FIRST_K_INDEX =
    STOCH_RSI_RSI_PERIOD + STOCH_RSI_STOCH_PERIOD - 1 + STOCH_RSI_K_PERIOD - 1;
// First non-null D index: FIRST_K_INDEX + dPeriod - 1
const FIRST_D_INDEX = FIRST_K_INDEX + STOCH_RSI_D_PERIOD - 1;

const STOCH_RSI_MIN = 0;
const STOCH_RSI_MAX = 1;

describe('Stochastic RSI', () => {
    describe('calculateStochRSI', () => {
        describe('빈 배열일 때', () => {
            it('빈 배열을 반환한다', () => {
                expect(calculateStochRSI([])).toEqual([]);
            });
        });

        describe('입력 배열 길이가 rsiPeriod 미만일 때', () => {
            it('모든 결과가 null이다', () => {
                const TEST_LENGTH = 5;
                const closes = Array.from(
                    { length: TEST_LENGTH },
                    (_, i) => 100 + i
                );
                const result = calculateStochRSI(closes);
                expect(result.every(r => r.k === null && r.d === null)).toBe(
                    true
                );
            });
        });

        describe('입력 배열 길이가 rsiPeriod와 같을 때', () => {
            it('모든 결과가 null이다', () => {
                const closes = Array.from(
                    { length: STOCH_RSI_RSI_PERIOD },
                    (_, i) => 100 + i
                );
                const result = calculateStochRSI(closes);
                expect(result.every(r => r.k === null && r.d === null)).toBe(
                    true
                );
            });
        });

        describe('정상 입력일 때', () => {
            const TEST_BAR_COUNT = 60;
            const closes = Array.from(
                { length: TEST_BAR_COUNT },
                (_, i) => 100 + Math.sin(i) * 10
            );

            it('입력과 동일한 길이의 배열을 반환한다', () => {
                const result = calculateStochRSI(closes);
                expect(result).toHaveLength(TEST_BAR_COUNT);
            });

            it('처음 FIRST_K_INDEX개의 K 값은 null이다', () => {
                const result = calculateStochRSI(closes);
                expect(
                    result.slice(0, FIRST_K_INDEX).every(r => r.k === null)
                ).toBe(true);
            });

            it('FIRST_K_INDEX번째 이후 K 값은 null이 아닌 숫자다', () => {
                const result = calculateStochRSI(closes);
                expect(
                    result
                        .slice(FIRST_K_INDEX)
                        .every(r => typeof r.k === 'number')
                ).toBe(true);
            });

            it('처음 FIRST_D_INDEX개의 D 값은 null이다', () => {
                const result = calculateStochRSI(closes);
                expect(
                    result.slice(0, FIRST_D_INDEX).every(r => r.d === null)
                ).toBe(true);
            });

            it('FIRST_D_INDEX번째 이후 D 값은 null이 아닌 숫자다', () => {
                const result = calculateStochRSI(closes);
                expect(
                    result
                        .slice(FIRST_D_INDEX)
                        .every(r => typeof r.d === 'number')
                ).toBe(true);
            });

            it('K 값은 0 이상 1 이하다', () => {
                const result = calculateStochRSI(closes);
                result.forEach(r => {
                    if (r.k !== null) {
                        expect(r.k).toBeGreaterThanOrEqual(STOCH_RSI_MIN);
                        expect(r.k).toBeLessThanOrEqual(STOCH_RSI_MAX);
                    }
                });
            });

            it('D 값은 0 이상 1 이하다', () => {
                const result = calculateStochRSI(closes);
                result.forEach(r => {
                    if (r.d !== null) {
                        expect(r.d).toBeGreaterThanOrEqual(STOCH_RSI_MIN);
                        expect(r.d).toBeLessThanOrEqual(STOCH_RSI_MAX);
                    }
                });
            });

            it('기본 파라미터는 (14, 14, 3, 3)이다', () => {
                expect(calculateStochRSI(closes)).toEqual(
                    calculateStochRSI(
                        closes,
                        STOCH_RSI_RSI_PERIOD,
                        STOCH_RSI_STOCH_PERIOD,
                        STOCH_RSI_K_PERIOD,
                        STOCH_RSI_D_PERIOD
                    )
                );
            });
        });

        describe('계산 정확성', () => {
            it('RSI 범위가 0일 때 K는 0이다', () => {
                // 모든 close가 같으면 RSI 변동 없음 → range = 0 → StochRSI = 0
                const FLAT_VALUE = 100;
                const FLAT_COUNT = 60;
                const closes = Array.from(
                    { length: FLAT_COUNT },
                    () => FLAT_VALUE
                );
                const result = calculateStochRSI(closes);
                result.forEach(r => {
                    if (r.k !== null) {
                        expect(r.k).toBe(STOCH_RSI_MIN);
                    }
                });
            });

            it('가격이 계속 상승할 때 RSI는 100으로 고정되어 StochRSI K는 0이다', () => {
                // 순수 상승 → RSI 수렴 100 → 변동 없음 → range = 0 → StochRSI = 0
                const ASCENDING_COUNT = 100;
                const closes = Array.from(
                    { length: ASCENDING_COUNT },
                    (_, i) => 100 + i
                );
                const result = calculateStochRSI(closes);
                const lastResult = result[result.length - 1];
                if (lastResult.k !== null) {
                    expect(lastResult.k).toBe(STOCH_RSI_MIN);
                }
            });

            it('첫 번째 유효한 K 값은 숫자다', () => {
                const TEST_COUNT = 60;
                const closes = Array.from(
                    { length: TEST_COUNT },
                    (_, i) => 100 + Math.sin(i) * 10
                );
                const result = calculateStochRSI(closes);
                expect(result[FIRST_K_INDEX].k).not.toBeNull();
                expect(typeof result[FIRST_K_INDEX].k).toBe('number');
            });

            it('K가 null이 아닌데 D가 null인 구간이 존재한다', () => {
                const TEST_COUNT = 60;
                const closes = Array.from(
                    { length: TEST_COUNT },
                    (_, i) => 100 + Math.sin(i) * 10
                );
                const result = calculateStochRSI(closes);
                const kOnlyRange = result.slice(FIRST_K_INDEX, FIRST_D_INDEX);
                expect(kOnlyRange.length).toBeGreaterThan(0);
                expect(
                    kOnlyRange.every(r => r.k !== null && r.d === null)
                ).toBe(true);
            });
        });
    });
});
