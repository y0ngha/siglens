import {
    calculateIchimoku,
    calculateIchimokuFutureCloud,
} from '@/domain/indicators/ichimoku';
import {
    ICHIMOKU_BASE_PERIOD,
    ICHIMOKU_CONVERSION_PERIOD,
    ICHIMOKU_DISPLACEMENT,
    ICHIMOKU_SPAN_B_PERIOD,
} from '@/domain/indicators/constants';
import type { Bar } from '@/domain/types';

const makeBars = (count: number, startPrice = 100): Bar[] =>
    Array.from({ length: count }, (_, i) => ({
        time: 1000 + i,
        open: startPrice + i,
        high: startPrice + i + 2,
        low: startPrice + i - 2,
        close: startPrice + i,
        volume: 1000,
    }));

const TEST_BARS_FOR_TENKAN = 50;
const TEST_BARS_FOR_KIJUN = 100;
const TEST_BARS_FOR_SENKOA = 150;
const TEST_BARS_FOR_SENKOB = 200;

describe('Ichimoku', () => {
    describe('calculateIchimoku', () => {
        describe('입력 배열이 비어있을 때', () => {
            it('빈 배열을 반환한다', () => {
                expect(calculateIchimoku([])).toEqual([]);
            });
        });

        describe('입력 배열 길이가 conversion period 미만일 때', () => {
            it('모든 필드가 null인 배열을 반환한다', () => {
                const BELOW_PERIOD_COUNT = ICHIMOKU_CONVERSION_PERIOD - 4;
                const bars = makeBars(BELOW_PERIOD_COUNT);
                const result = calculateIchimoku(bars);
                expect(result).toHaveLength(BELOW_PERIOD_COUNT);
                expect(
                    result.every(
                        r =>
                            r.tenkan === null &&
                            r.kijun === null &&
                            r.senkouA === null &&
                            r.senkouB === null &&
                            r.chikou === null
                    )
                ).toBe(true);
            });
        });

        describe('결과 배열 길이', () => {
            it('bars.length와 동일한 길이의 배열을 반환한다', () => {
                const bars = makeBars(TEST_BARS_FOR_KIJUN);
                const result = calculateIchimoku(bars);
                expect(result).toHaveLength(TEST_BARS_FOR_KIJUN);
            });
        });

        describe('tenkan 초기 null 범위', () => {
            it(`처음 ${ICHIMOKU_CONVERSION_PERIOD - 1}개의 tenkan 값은 null이다`, () => {
                const bars = makeBars(TEST_BARS_FOR_TENKAN);
                const result = calculateIchimoku(bars);
                expect(
                    result
                        .slice(0, ICHIMOKU_CONVERSION_PERIOD - 1)
                        .every(r => r.tenkan === null)
                ).toBe(true);
            });

            it(`인덱스 ${ICHIMOKU_CONVERSION_PERIOD - 1}부터 tenkan 값은 숫자다`, () => {
                const bars = makeBars(TEST_BARS_FOR_TENKAN);
                const result = calculateIchimoku(bars);
                expect(
                    typeof result[ICHIMOKU_CONVERSION_PERIOD - 1].tenkan
                ).toBe('number');
            });
        });

        describe('kijun 초기 null 범위', () => {
            it(`처음 ${ICHIMOKU_BASE_PERIOD - 1}개의 kijun 값은 null이다`, () => {
                const bars = makeBars(TEST_BARS_FOR_KIJUN);
                const result = calculateIchimoku(bars);
                expect(
                    result
                        .slice(0, ICHIMOKU_BASE_PERIOD - 1)
                        .every(r => r.kijun === null)
                ).toBe(true);
            });

            it(`인덱스 ${ICHIMOKU_BASE_PERIOD - 1}부터 kijun 값은 숫자다`, () => {
                const bars = makeBars(TEST_BARS_FOR_KIJUN);
                const result = calculateIchimoku(bars);
                expect(typeof result[ICHIMOKU_BASE_PERIOD - 1].kijun).toBe(
                    'number'
                );
            });
        });

        describe('senkouA 초기 null 범위', () => {
            // senkouA[i] requires i - displacement >= basePeriod - 1
            // i.e. i >= displacement + basePeriod - 1 = 26 + 25 = 51
            const SENKOA_FIRST_VALID =
                ICHIMOKU_DISPLACEMENT + ICHIMOKU_BASE_PERIOD - 1;

            it(`처음 ${SENKOA_FIRST_VALID}개의 senkouA 값은 null이다`, () => {
                const bars = makeBars(TEST_BARS_FOR_SENKOA);
                const result = calculateIchimoku(bars);
                expect(
                    result
                        .slice(0, SENKOA_FIRST_VALID)
                        .every(r => r.senkouA === null)
                ).toBe(true);
            });

            it(`인덱스 ${SENKOA_FIRST_VALID}부터 senkouA 값은 숫자다`, () => {
                const bars = makeBars(TEST_BARS_FOR_SENKOA);
                const result = calculateIchimoku(bars);
                expect(typeof result[SENKOA_FIRST_VALID].senkouA).toBe(
                    'number'
                );
            });
        });

        describe('senkouB 초기 null 범위', () => {
            // senkouB[i] requires i - displacement >= spanBPeriod - 1
            // i.e. i >= displacement + spanBPeriod - 1 = 26 + 51 = 77
            const SENKOB_FIRST_VALID =
                ICHIMOKU_DISPLACEMENT + ICHIMOKU_SPAN_B_PERIOD - 1;

            it(`처음 ${SENKOB_FIRST_VALID}개의 senkouB 값은 null이다`, () => {
                const bars = makeBars(TEST_BARS_FOR_SENKOB);
                const result = calculateIchimoku(bars);
                expect(
                    result
                        .slice(0, SENKOB_FIRST_VALID)
                        .every(r => r.senkouB === null)
                ).toBe(true);
            });

            it(`인덱스 ${SENKOB_FIRST_VALID}부터 senkouB 값은 숫자다`, () => {
                const bars = makeBars(TEST_BARS_FOR_SENKOB);
                const result = calculateIchimoku(bars);
                expect(typeof result[SENKOB_FIRST_VALID].senkouB).toBe(
                    'number'
                );
            });
        });

        describe('chikou 후행 처리', () => {
            it('마지막 displacement개의 chikou 값은 null이다', () => {
                const bars = makeBars(TEST_BARS_FOR_KIJUN);
                const result = calculateIchimoku(bars);
                expect(
                    result
                        .slice(bars.length - ICHIMOKU_DISPLACEMENT)
                        .every(r => r.chikou === null)
                ).toBe(true);
            });

            it('첫 번째 chikou 값은 displacement번째 봉의 종가다', () => {
                const bars = makeBars(TEST_BARS_FOR_KIJUN);
                const result = calculateIchimoku(bars);
                expect(result[0].chikou).toBe(
                    bars[ICHIMOKU_DISPLACEMENT].close
                );
            });
        });

        describe('계산 정확도', () => {
            it('tenkan 값은 N기간 최고가+최저가의 중간값이다', () => {
                const bars: Bar[] = Array.from({ length: 20 }, (_, i) => ({
                    time: 1000 + i,
                    open: 100,
                    high: 100 + i,
                    low: 100 - i,
                    close: 100,
                    volume: 1000,
                }));

                const conversionPeriod = 3;
                const result = calculateIchimoku(bars, conversionPeriod);

                // At index 2: slice [0,1,2], high=max(100,101,102)=102, low=min(100,99,98)=98
                const expectedTenkan = (102 + 98) / 2;
                expect(result[2].tenkan).toBeCloseTo(expectedTenkan, 6);
            });

            it('senkouA 값은 displacement봉 전 tenkan과 kijun의 평균이다', () => {
                const bars = makeBars(TEST_BARS_FOR_KIJUN);
                const result = calculateIchimoku(bars);

                const FIRST_VALID =
                    ICHIMOKU_DISPLACEMENT + ICHIMOKU_BASE_PERIOD - 1;
                const sourceIdx = FIRST_VALID - ICHIMOKU_DISPLACEMENT;

                // Compute tenkan and kijun at sourceIdx manually
                const tenkanSlice = bars.slice(
                    sourceIdx - ICHIMOKU_CONVERSION_PERIOD + 1,
                    sourceIdx + 1
                );
                const tenkanHigh = tenkanSlice.reduce(
                    (max, b) => (b.high > max ? b.high : max),
                    tenkanSlice[0].high
                );
                const tenkanLow = tenkanSlice.reduce(
                    (min, b) => (b.low < min ? b.low : min),
                    tenkanSlice[0].low
                );
                const expectedTenkan = (tenkanHigh + tenkanLow) / 2;

                const kijunSlice = bars.slice(
                    sourceIdx - ICHIMOKU_BASE_PERIOD + 1,
                    sourceIdx + 1
                );
                const kijunHigh = kijunSlice.reduce(
                    (max, b) => (b.high > max ? b.high : max),
                    kijunSlice[0].high
                );
                const kijunLow = kijunSlice.reduce(
                    (min, b) => (b.low < min ? b.low : min),
                    kijunSlice[0].low
                );
                const expectedKijun = (kijunHigh + kijunLow) / 2;

                const expectedSenkouA = (expectedTenkan + expectedKijun) / 2;
                expect(result[FIRST_VALID].senkouA).toBeCloseTo(
                    expectedSenkouA,
                    6
                );
            });
        });

        describe('커스텀 파라미터', () => {
            it('커스텀 파라미터를 사용하면 기본 파라미터와 다른 결과를 반환한다', () => {
                const bars = makeBars(TEST_BARS_FOR_KIJUN);
                const defaultResult = calculateIchimoku(bars);
                const customResult = calculateIchimoku(bars, 7, 22, 44, 22);
                expect(defaultResult[50].tenkan).not.toBe(
                    customResult[50].tenkan
                );
            });
        });
    });

    describe('calculateIchimokuFutureCloud', () => {
        describe('입력 배열이 비어있을 때', () => {
            it('빈 배열을 반환한다', () => {
                expect(calculateIchimokuFutureCloud([])).toEqual([]);
            });
        });

        describe('결과 배열 길이', () => {
            it('displacement 길이의 배열을 반환한다', () => {
                const bars = makeBars(TEST_BARS_FOR_SENKOB);
                const result = calculateIchimokuFutureCloud(bars);
                expect(result).toHaveLength(ICHIMOKU_DISPLACEMENT);
            });
        });

        describe('미래 선행스팬 값', () => {
            it('bars 데이터가 충분하면 senkouA 값이 null이 아니다', () => {
                const bars = makeBars(TEST_BARS_FOR_SENKOB);
                const result = calculateIchimokuFutureCloud(bars);
                expect(
                    result[ICHIMOKU_DISPLACEMENT - 1].senkouA
                ).not.toBeNull();
            });

            it('bars 데이터가 충분하면 senkouB 값이 null이 아니다', () => {
                const bars = makeBars(TEST_BARS_FOR_SENKOB);
                const result = calculateIchimokuFutureCloud(bars);
                expect(
                    result[ICHIMOKU_DISPLACEMENT - 1].senkouB
                ).not.toBeNull();
            });

            it('미래 선행스팬A는 현재 ichimoku 결과와 연속적이다', () => {
                const bars = makeBars(TEST_BARS_FOR_SENKOB);
                const present = calculateIchimoku(bars);
                const future = calculateIchimokuFutureCloud(bars);
                // future[0].senkouA는 sourceIndex = bars.length - displacement를 기반으로 계산됨
                // present[bars.length - 1].senkouA는 sourceIndex = bars.length - 1 - displacement를 기반으로 계산됨
                // 두 값은 다른 sourceIndex를 가지므로 동일하지 않아야 한다
                expect(future[0].senkouA).not.toBe(
                    present[bars.length - 1].senkouA
                );
            });
        });

        describe('계산 정확도', () => {
            it('future[0].senkouA는 sourceIndex=bars.length-displacement에서의 tenkan+kijun 평균이다', () => {
                const bars = makeBars(TEST_BARS_FOR_SENKOB);
                const result = calculateIchimokuFutureCloud(bars);

                // future[0] uses sourceIndex = bars.length - displacement
                const sourceIndex = bars.length - ICHIMOKU_DISPLACEMENT;

                const tenkanSlice = bars.slice(
                    sourceIndex - ICHIMOKU_CONVERSION_PERIOD + 1,
                    sourceIndex + 1
                );
                const tenkanHigh = tenkanSlice.reduce(
                    (max, b) => (b.high > max ? b.high : max),
                    tenkanSlice[0].high
                );
                const tenkanLow = tenkanSlice.reduce(
                    (min, b) => (b.low < min ? b.low : min),
                    tenkanSlice[0].low
                );
                const expectedTenkan = (tenkanHigh + tenkanLow) / 2;

                const kijunSlice = bars.slice(
                    sourceIndex - ICHIMOKU_BASE_PERIOD + 1,
                    sourceIndex + 1
                );
                const kijunHigh = kijunSlice.reduce(
                    (max, b) => (b.high > max ? b.high : max),
                    kijunSlice[0].high
                );
                const kijunLow = kijunSlice.reduce(
                    (min, b) => (b.low < min ? b.low : min),
                    kijunSlice[0].low
                );
                const expectedKijun = (kijunHigh + kijunLow) / 2;

                const expectedSenkouA = (expectedTenkan + expectedKijun) / 2;
                expect(result[0].senkouA).toBeCloseTo(expectedSenkouA, 6);
            });
        });

        describe('bars 데이터가 부족할 때', () => {
            it('spanB period 미만의 sourceIndex를 가질 때 senkouB는 null이다', () => {
                // bars 길이가 displacement보다 작으면 sourceIndex < 0인 경우 발생
                const bars = makeBars(ICHIMOKU_DISPLACEMENT - 1);
                const result = calculateIchimokuFutureCloud(bars);
                expect(result[0].senkouB).toBeNull();
            });
        });
    });
});
