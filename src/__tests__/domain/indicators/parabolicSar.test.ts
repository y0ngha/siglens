import { calculateParabolicSAR } from '@y0ngha/siglens-core';
import {
    PSAR_AF_INCREMENT,
    PSAR_AF_MAX,
    PSAR_AF_START,
} from '@y0ngha/siglens-core';
import type { Bar, ParabolicSARResult } from '@y0ngha/siglens-core';

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

const NULL_RESULT: ParabolicSARResult = { sar: null, trend: null };

describe('calculateParabolicSAR', () => {
    describe('입력 배열이 비어있을 때', () => {
        it('빈 배열을 반환한다', () => {
            expect(calculateParabolicSAR([])).toEqual([]);
        });
    });

    describe('봉이 1개일 때', () => {
        it('null 결과를 반환한다', () => {
            const bars = makeBars([{ high: 110, low: 90, close: 100 }]);
            expect(calculateParabolicSAR(bars)).toEqual([NULL_RESULT]);
        });
    });

    describe('봉이 여러 개일 때', () => {
        it('입력과 동일한 길이의 배열을 반환한다', () => {
            const bars = makeBars(
                Array.from({ length: 20 }, (_, i) => ({
                    high: 110 + i,
                    low: 90 + i,
                    close: 100 + i,
                }))
            );
            expect(calculateParabolicSAR(bars)).toHaveLength(20);
        });

        it('첫 번째 봉은 null이다', () => {
            const bars = makeBars([
                { high: 110, low: 90, close: 100 },
                { high: 115, low: 95, close: 105 },
                { high: 120, low: 100, close: 110 },
            ]);
            const result = calculateParabolicSAR(bars);
            expect(result[0]).toEqual(NULL_RESULT);
        });

        it('두 번째 봉부터 sar와 trend가 존재한다', () => {
            const bars = makeBars([
                { high: 110, low: 90, close: 100 },
                { high: 115, low: 95, close: 105 },
                { high: 120, low: 100, close: 110 },
            ]);
            const result = calculateParabolicSAR(bars);
            expect(result[1].sar).not.toBeNull();
            expect(result[1].trend).not.toBeNull();
            expect(result[2].sar).not.toBeNull();
            expect(result[2].trend).not.toBeNull();
        });

        it('상승 추세에서 SAR은 가격 아래에 위치한다', () => {
            const bars = makeBars(
                Array.from({ length: 10 }, (_, i) => ({
                    high: 110 + i * 5,
                    low: 90 + i * 5,
                    close: 100 + i * 5,
                }))
            );
            const result = calculateParabolicSAR(bars);
            result.slice(1).forEach((r: ParabolicSARResult) => {
                expect(r.trend).toBe('up');
            });
        });

        it('하락 추세에서 SAR은 가격 위에 위치한다', () => {
            const bars = makeBars(
                Array.from({ length: 10 }, (_, i) => ({
                    high: 110 - i * 5,
                    low: 90 - i * 5,
                    close: 100 - i * 5,
                }))
            );
            const result = calculateParabolicSAR(bars);
            result.slice(1).forEach((r: ParabolicSARResult) => {
                expect(r.trend).toBe('down');
            });
        });

        it('추세 반전이 감지된다', () => {
            const bars = makeBars([
                { high: 110, low: 90, close: 100 },
                { high: 115, low: 95, close: 110 },
                { high: 120, low: 100, close: 115 },
                { high: 125, low: 105, close: 120 },
                { high: 100, low: 80, close: 85 }, // 급격한 하락 → 반전
                { high: 90, low: 70, close: 75 },
            ]);
            const result = calculateParabolicSAR(bars);
            const trends = result
                .filter(r => r.trend !== null)
                .map(r => r.trend);
            const hasUp = trends.includes('up');
            const hasDown = trends.includes('down');
            expect(hasUp && hasDown).toBe(true);
        });

        it('상승 추세에서 SAR은 직전 2봉의 저점을 초과하지 않는다 (Wilder clamp)', () => {
            const bars = makeBars(
                Array.from({ length: 15 }, (_, i) => ({
                    high: 110 + i * 5,
                    low: 90 + i * 5,
                    close: 100 + i * 5,
                }))
            );
            const result = calculateParabolicSAR(bars);
            result.forEach((r, i) => {
                if (i < 2 || r.trend !== 'up' || r.sar === null) return;
                const bound = Math.min(bars[i - 1].low, bars[i - 2].low);
                expect(r.sar).toBeLessThanOrEqual(bound);
            });
        });

        it('하락 추세에서 SAR은 직전 2봉의 고점 미만으로 내려가지 않는다 (Wilder clamp)', () => {
            const bars = makeBars(
                Array.from({ length: 15 }, (_, i) => ({
                    high: 110 - i * 5,
                    low: 90 - i * 5,
                    close: 100 - i * 5,
                }))
            );
            const result = calculateParabolicSAR(bars);
            result.forEach((r, i) => {
                if (i < 2 || r.trend !== 'down' || r.sar === null) return;
                const bound = Math.max(bars[i - 1].high, bars[i - 2].high);
                expect(r.sar).toBeGreaterThanOrEqual(bound);
            });
        });

        it('첫 번째 유효 SAR 값이 명세와 일치한다', () => {
            // bars[1].close(11) >= bars[0].close(9) → initialTrend='up'
            // initialState.sar = bars[0].low = 8 → result[1].sar = 8
            const bars = makeBars([
                { high: 10, low: 8, close: 9 },
                { high: 12, low: 10, close: 11 },
                { high: 14, low: 12, close: 13 },
            ]);
            const result = calculateParabolicSAR(bars);
            expect(result[1].sar).toBeCloseTo(8, 5);
            expect(result[1].trend).toBe('up');
        });

        it('기본값이 올바르다', () => {
            const bars = makeBars(
                Array.from({ length: 10 }, (_, i) => ({
                    high: 110 + i,
                    low: 90 + i,
                    close: 100 + i,
                }))
            );
            expect(calculateParabolicSAR(bars)).toEqual(
                calculateParabolicSAR(
                    bars,
                    PSAR_AF_START,
                    PSAR_AF_INCREMENT,
                    PSAR_AF_MAX
                )
            );
        });
    });
});
