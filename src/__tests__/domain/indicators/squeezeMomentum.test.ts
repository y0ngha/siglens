import { calculateSqueezeMomentum } from '@/domain/indicators/squeezeMomentum';
import {
    SQUEEZE_MOMENTUM_BB_LENGTH,
    SQUEEZE_MOMENTUM_KC_LENGTH,
    SQUEEZE_MOMENTUM_KC_MULT,
    SQUEEZE_MOMENTUM_MIN_BARS,
} from '@/domain/indicators/constants';
import type { Bar, SqueezeMomentumResult } from '@/domain/types';

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

// Minimum bars for any non-null output in BB/KC (inner indicators warmup)
const MIN_BARS = Math.max(
    SQUEEZE_MOMENTUM_BB_LENGTH,
    SQUEEZE_MOMENTUM_KC_LENGTH
);

describe('calculateSqueezeMomentum', () => {
    describe('입력 배열이 비어있을 때', () => {
        it('빈 배열을 반환한다', () => {
            expect(calculateSqueezeMomentum([])).toEqual([]);
        });
    });

    describe('입력 배열 길이가 period 미만일 때', () => {
        it('전부 null인 결과 배열을 반환한다', () => {
            const bars = makeUniformBars(MIN_BARS - 1);
            const result = calculateSqueezeMomentum(bars);
            expect(result).toHaveLength(bars.length);
            expect(result.every(r => r.val === null)).toBe(true);
        });
    });

    describe('입력 배열 길이가 충분할 때', () => {
        it('입력과 동일한 길이의 배열을 반환한다', () => {
            const bars = makeUniformBars(50);
            expect(calculateSqueezeMomentum(bars)).toHaveLength(50);
        });

        it('첫 번째 유효한 val은 실제 워밍업 기간 이후에 나타난다', () => {
            const bars = makeUniformBars(SQUEEZE_MOMENTUM_MIN_BARS + 10);
            const result = calculateSqueezeMomentum(bars);
            expect(
                result
                    .slice(0, SQUEEZE_MOMENTUM_MIN_BARS - 1)
                    .every(r => r.val === null)
            ).toBe(true);
            expect(result[SQUEEZE_MOMENTUM_MIN_BARS - 1].val).not.toBeNull();
        });

        it('충분한 데이터 이후 val은 number다', () => {
            const bars = makeUniformBars(50);
            const result = calculateSqueezeMomentum(bars);
            const valid = result.filter(r => r.val !== null);
            expect(valid.length).toBeGreaterThan(0);
            valid.forEach(r => {
                expect(typeof r.val).toBe('number');
            });
        });

        it('기본값이 올바르다', () => {
            const bars = makeUniformBars(50);
            expect(calculateSqueezeMomentum(bars)).toEqual(
                calculateSqueezeMomentum(
                    bars,
                    SQUEEZE_MOMENTUM_BB_LENGTH,
                    SQUEEZE_MOMENTUM_KC_LENGTH,
                    SQUEEZE_MOMENTUM_KC_MULT
                )
            );
        });
    });

    describe('균일 가격 데이터일 때', () => {
        it('val이 0에 수렴한다 (모멘텀 없음)', () => {
            const bars = makeUniformBars(60);
            const result = calculateSqueezeMomentum(bars);
            result
                .filter(r => r.val !== null)
                .forEach(r => {
                    expect(r.val as number).toBeCloseTo(0, 5);
                });
        });

        it('균일 가격에서 sqzOn/sqzOff/noSqz 중 하나만 true다', () => {
            const bars = makeUniformBars(60);
            const result = calculateSqueezeMomentum(bars);
            result
                .filter(r => r.sqzOn !== null)
                .forEach(r => {
                    const trueCount = [r.sqzOn, r.sqzOff, r.noSqz].filter(
                        Boolean
                    ).length;
                    expect(trueCount).toBe(1);
                });
        });

        it('stdDev≈0인 균일 가격에서 sqzOn이 true다 (BB가 KC 안에 압축됨)', () => {
            // Uniform close → stdDev ≈ 0 → BB width ≈ 0 (very narrow)
            // True range = high-low = 10 → KC width = 1.5*10 = 15 (wide)
            // BB is entirely inside KC → sqzOn must be true
            const bars = makeUniformBars(60);
            const valid = calculateSqueezeMomentum(bars).filter(
                r => r.sqzOn !== null
            );
            expect(valid.length).toBeGreaterThan(0);
            valid.forEach(r => {
                expect(r.sqzOn).toBe(true);
            });
        });
    });

    describe('계산 정확도', () => {
        it('첫 번째 유효한 val이 명세와 일치한다', () => {
            // Linear trend: close[i] = 100 + i, high[i] = 105 + i, low[i] = 95 + i
            // For any bar at index j >= kcLength - 1:
            //   highestHigh = 105 + j, lowestLow = 76 + j (= 95 + (j - kcLength + 1) when kcLength=20)
            //   closeSma over [j-19..j] = 90.5 + j
            //   delta = close[j] - ((highestHigh + lowestLow)/2 + closeSma)/2
            //         = (100+j) - ((90.5+j) + (90.5+j))/2 = (100+j) - (90.5+j) = 9.5
            // linreg([9.5, ..., 9.5], 20) = 9.5 (constant series → slope=0, intercept=9.5)
            const bars = makeBars(
                Array.from({ length: 40 }, (_, i) => ({
                    high: 105 + i,
                    low: 95 + i,
                    close: 100 + i,
                }))
            );
            const result = calculateSqueezeMomentum(bars);
            const firstValid = result.find(r => r.val !== null);
            expect(firstValid?.val).toBeCloseTo(9.5, 4);
        });
    });

    describe('상승 추세 데이터일 때', () => {
        it('val이 양수가 된다 (상승 모멘텀)', () => {
            const bars = makeBars(
                Array.from({ length: 60 }, (_, i) => ({
                    high: 100 + i + 5,
                    low: 100 + i - 5,
                    close: 100 + i,
                }))
            );
            const result = calculateSqueezeMomentum(bars);
            const valid = result.filter(r => r.val !== null);
            const lastVal = valid[valid.length - 1].val!;
            expect(lastVal).toBeGreaterThan(0);
        });
    });

    describe('하락 추세 데이터일 때', () => {
        it('val이 음수가 된다 (하락 모멘텀)', () => {
            const bars = makeBars(
                Array.from({ length: 60 }, (_, i) => ({
                    high: 200 - i + 5,
                    low: 200 - i - 5,
                    close: 200 - i,
                }))
            );
            const result = calculateSqueezeMomentum(bars);
            const valid = result.filter(r => r.val !== null);
            const lastVal = valid[valid.length - 1].val!;
            expect(lastVal).toBeLessThan(0);
        });
    });

    describe('increasing 필드', () => {
        it('첫 번째 유효한 val은 increasing이 null이다', () => {
            const bars = makeUniformBars(50);
            const result = calculateSqueezeMomentum(bars);
            const firstValid = result.find(r => r.val !== null);
            expect(firstValid?.increasing).toBeNull();
        });

        it('두 번째 이후 유효 val은 increasing이 boolean이다', () => {
            const bars = makeBars(
                Array.from({ length: 60 }, (_, i) => ({
                    high: 100 + i + 5,
                    low: 100 + i - 5,
                    close: 100 + i,
                }))
            );
            const result = calculateSqueezeMomentum(bars);
            const valid = result.filter(r => r.val !== null);
            // Skip the first valid entry (increasing === null)
            valid.slice(1).forEach(r => {
                expect(typeof r.increasing).toBe('boolean');
            });
        });
    });

    describe('sqzOn / sqzOff / noSqz 상호 배타성', () => {
        it('유효한 결과에서 세 상태 중 정확히 하나만 true다', () => {
            const bars = makeBars(
                Array.from({ length: 60 }, (_, i) => ({
                    high: 100 + Math.sin(i) * 10,
                    low: 100 + Math.sin(i) * 10 - 10,
                    close: 100 + Math.sin(i) * 5,
                }))
            );
            const result = calculateSqueezeMomentum(bars);
            result
                .filter(r => r.sqzOn !== null)
                .forEach((r: SqueezeMomentumResult) => {
                    const count = [r.sqzOn, r.sqzOff, r.noSqz].filter(
                        Boolean
                    ).length;
                    expect(count).toBe(1);
                });
        });
    });
});
