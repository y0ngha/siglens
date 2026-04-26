import { calculateRSI } from '@/domain/indicators/rsi';
import { RSI_DEFAULT_PERIOD } from '@/domain/indicators/constants';

describe('calculateRSI', () => {
    describe('입력 배열이 비어있을 때', () => {
        it('빈 배열을 반환한다', () => {
            expect(calculateRSI([], RSI_DEFAULT_PERIOD)).toEqual([]);
        });
    });

    describe('입력 배열 길이가 period 미만일 때', () => {
        it('전부 null인 배열을 반환한다', () => {
            const closes = Array.from({ length: 5 }, (_, i) => 100 + i);
            const result = calculateRSI(closes, RSI_DEFAULT_PERIOD);
            expect(result.every(v => v === null)).toBe(true);
        });
    });

    describe('입력 배열 길이가 period와 같을 때', () => {
        it('전부 null인 배열을 반환한다', () => {
            const closes = Array.from(
                { length: RSI_DEFAULT_PERIOD },
                (_, i) => 100 + i
            );
            const result = calculateRSI(closes, RSI_DEFAULT_PERIOD);
            expect(result.every(v => v === null)).toBe(true);
        });
    });

    describe('입력 배열 길이가 period를 초과할 때', () => {
        it('입력과 동일한 길이의 배열을 반환한다', () => {
            const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
            const result = calculateRSI(closes, RSI_DEFAULT_PERIOD);
            expect(result).toHaveLength(20);
        });

        it('처음 period개의 값은 null이다', () => {
            const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
            const result = calculateRSI(closes, RSI_DEFAULT_PERIOD);
            expect(
                result.slice(0, RSI_DEFAULT_PERIOD).every(v => v === null)
            ).toBe(true);
        });

        it('period번째 이후 값은 null이 아닌 숫자다', () => {
            const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
            const result = calculateRSI(closes, RSI_DEFAULT_PERIOD);
            expect(
                result
                    .slice(RSI_DEFAULT_PERIOD)
                    .every(v => typeof v === 'number')
            ).toBe(true);
        });

        it('반환값은 (number | null)[] 타입이다', () => {
            const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
            const result = calculateRSI(closes, RSI_DEFAULT_PERIOD);
            result.forEach(v => {
                expect(v === null || typeof v === 'number').toBe(true);
            });
        });

        it('RSI 값은 0 이상 100 이하다', () => {
            const closes = Array.from(
                { length: 30 },
                (_, i) => 100 + Math.sin(i) * 10
            );
            const result = calculateRSI(closes, RSI_DEFAULT_PERIOD);
            result.slice(RSI_DEFAULT_PERIOD).forEach(v => {
                expect(v).toBeGreaterThanOrEqual(0);
                expect(v).toBeLessThanOrEqual(100);
            });
        });

        it('가격이 계속 상승할 때 RSI는 100에 수렴한다', () => {
            const closes = Array.from({ length: 100 }, (_, i) => 100 + i);
            const result = calculateRSI(closes, RSI_DEFAULT_PERIOD);
            const lastRSI = result[result.length - 1] as number;
            expect(lastRSI).toBeCloseTo(100, 0);
        });

        it('가격이 계속 하락할 때 RSI는 0에 수렴한다', () => {
            const closes = Array.from({ length: 100 }, (_, i) => 200 - i);
            const result = calculateRSI(closes, RSI_DEFAULT_PERIOD);
            const lastRSI = result[result.length - 1] as number;
            expect(lastRSI).toBeCloseTo(0, 0);
        });

        it('avgLoss가 0일 때 RSI는 100이다', () => {
            const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
            const result = calculateRSI(closes, RSI_DEFAULT_PERIOD);
            expect(result[RSI_DEFAULT_PERIOD]).toBe(100);
        });

        it('period 기본값은 RSI_DEFAULT_PERIOD다', () => {
            const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
            expect(calculateRSI(closes)).toEqual(
                calculateRSI(closes, RSI_DEFAULT_PERIOD)
            );
        });

        it('Wilder smoothing이 올바르게 적용된다', () => {
            // period + 2개 데이터 필요 (diffs.slice(period)가 최소 1회 실행되어야 Wilder 공식 검증 가능)
            // initialAvgGain = 3.53/14 ≈ 0.2521, initialAvgLoss = 3.87/14 ≈ 0.2764
            // 16번째 close = 44.50 → diff = +0.50
            // avgGain_new = (0.2521 * 13 + 0.50) / 14 ≈ 0.2698 → RSI[15] ≈ 51.25
            const closes = [
                44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.15, 43.61,
                44.33, 44.83, 45.1, 45.15, 43.61, 44.0, 44.5,
            ];
            const result = calculateRSI(closes, RSI_DEFAULT_PERIOD);
            expect(result[RSI_DEFAULT_PERIOD + 1]).toBeCloseTo(51.25, 1);
        });
    });
});
