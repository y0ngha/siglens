import { calculateOBV } from '@/domain/indicators/obv';
import type { Bar } from '@/domain/types';

function makeBars(values: { close: number; volume: number }[]): Bar[] {
    return values.map((v, i) => ({
        time: i,
        open: v.close,
        high: v.close + 1,
        low: v.close - 1,
        close: v.close,
        volume: v.volume,
    }));
}

describe('calculateOBV', () => {
    describe('입력 배열이 비어있을 때', () => {
        it('빈 배열을 반환한다', () => {
            expect(calculateOBV([])).toEqual([]);
        });
    });

    describe('봉이 1개일 때', () => {
        it('첫 봉의 거래량을 반환한다', () => {
            const bars = makeBars([{ close: 100, volume: 5000 }]);
            expect(calculateOBV(bars)).toEqual([5000]);
        });
    });

    describe('봉이 여러 개일 때', () => {
        it('입력과 동일한 길이의 배열을 반환한다', () => {
            const bars = makeBars([
                { close: 100, volume: 1000 },
                { close: 101, volume: 2000 },
                { close: 99, volume: 1500 },
            ]);
            expect(calculateOBV(bars)).toHaveLength(3);
        });

        it('null 값이 없다', () => {
            const bars = makeBars([
                { close: 100, volume: 1000 },
                { close: 101, volume: 2000 },
                { close: 99, volume: 1500 },
            ]);
            const result = calculateOBV(bars);
            expect(result.every(v => typeof v === 'number')).toBe(true);
        });

        it('가격 상승 시 거래량을 더한다', () => {
            const bars = makeBars([
                { close: 100, volume: 1000 },
                { close: 105, volume: 2000 },
            ]);
            const result = calculateOBV(bars);
            expect(result[1]).toBe(3000);
        });

        it('가격 하락 시 거래량을 뺀다', () => {
            const bars = makeBars([
                { close: 100, volume: 1000 },
                { close: 95, volume: 2000 },
            ]);
            const result = calculateOBV(bars);
            expect(result[1]).toBe(-1000);
        });

        it('가격이 같을 때 OBV는 변하지 않는다', () => {
            const bars = makeBars([
                { close: 100, volume: 1000 },
                { close: 100, volume: 2000 },
            ]);
            const result = calculateOBV(bars);
            expect(result[1]).toBe(1000);
        });

        it('누적 계산이 올바르다', () => {
            const bars = makeBars([
                { close: 100, volume: 1000 },
                { close: 105, volume: 2000 }, // +2000 → 3000
                { close: 103, volume: 1500 }, // -1500 → 1500
                { close: 103, volume: 800 }, // same  → 1500
                { close: 110, volume: 3000 }, // +3000 → 4500
            ]);
            const result = calculateOBV(bars);
            expect(result).toEqual([1000, 3000, 1500, 1500, 4500]);
        });
    });
});
