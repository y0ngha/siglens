import {
    findPivotLows,
    findPivotHighs,
    computeBbWidth,
    computePctB,
    computeEma20Slope,
    percentileRank,
} from '@/domain/signals/anticipation';
import type { BollingerResult } from '@/domain/types';

describe('findPivotLows', () => {
    describe('창 내에 명확한 저점이 있을 때', () => {
        it('좌우 2봉보다 엄격히 낮은 지점 인덱스를 반환한다', () => {
            const lows = [100, 98, 95, 92, 90, 92, 95, 97, 99];
            expect(findPivotLows(lows, 2)).toEqual([4]);
        });
    });
    describe('좌우 2봉 중 타이가 있을 때', () => {
        it('해당 인덱스를 제외한다', () => {
            const lows = [100, 98, 90, 92, 90, 92, 95];
            expect(findPivotLows(lows, 2)).toEqual([]);
        });
    });
    describe('경계 조건', () => {
        it('window보다 작은 인덱스는 반환하지 않는다', () => {
            const lows = [90, 95, 100, 95, 90];
            expect(findPivotLows(lows, 2)).toEqual([]);
        });
        it('빈 배열에 대해 빈 배열을 반환한다', () => {
            expect(findPivotLows([], 2)).toEqual([]);
        });
    });
});

describe('findPivotHighs', () => {
    describe('창 내에 명확한 고점이 있을 때', () => {
        it('인덱스를 반환한다', () => {
            const highs = [100, 102, 105, 108, 110, 108, 105, 103, 101];
            expect(findPivotHighs(highs, 2)).toEqual([4]);
        });
    });
    describe('좌우에 타이가 있을 때', () => {
        it('해당 인덱스를 제외한다', () => {
            const highs = [100, 102, 110, 108, 110, 108, 105];
            expect(findPivotHighs(highs, 2)).toEqual([]);
        });
    });
    describe('경계 조건', () => {
        it('빈 배열에 대해 빈 배열을 반환한다', () => {
            expect(findPivotHighs([], 2)).toEqual([]);
        });
    });
});

describe('computeBbWidth', () => {
    it('(upper - lower) / middle 을 반환한다', () => {
        const bb: BollingerResult = { upper: 110, middle: 100, lower: 90 };
        expect(computeBbWidth(bb)).toBeCloseTo(0.2);
    });
    it('middle이 0일 때 null을 반환한다', () => {
        const bb: BollingerResult = { upper: 1, middle: 0, lower: -1 };
        expect(computeBbWidth(bb)).toBeNull();
    });
    describe('nullable 필드 처리', () => {
        it('upper가 null이면 null을 반환한다', () => {
            const bb: BollingerResult = { upper: null, middle: 100, lower: 90 };
            expect(computeBbWidth(bb)).toBeNull();
        });
        it('middle이 null이면 null을 반환한다', () => {
            const bb: BollingerResult = { upper: 110, middle: null, lower: 90 };
            expect(computeBbWidth(bb)).toBeNull();
        });
        it('lower가 null이면 null을 반환한다', () => {
            const bb: BollingerResult = { upper: 110, middle: 100, lower: null };
            expect(computeBbWidth(bb)).toBeNull();
        });
    });
});

describe('computePctB', () => {
    it('(close - lower) / (upper - lower) 를 반환한다', () => {
        const bb: BollingerResult = { upper: 110, middle: 100, lower: 90 };
        expect(computePctB(105, bb)).toBeCloseTo(0.75);
    });
    it('upper == lower 일 때 null을 반환한다', () => {
        const bb: BollingerResult = { upper: 100, middle: 100, lower: 100 };
        expect(computePctB(100, bb)).toBeNull();
    });
    describe('nullable 필드 처리', () => {
        it('upper가 null이면 null을 반환한다', () => {
            const bb: BollingerResult = { upper: null, middle: 100, lower: 90 };
            expect(computePctB(100, bb)).toBeNull();
        });
        it('lower가 null이면 null을 반환한다', () => {
            const bb: BollingerResult = { upper: 110, middle: 100, lower: null };
            expect(computePctB(100, bb)).toBeNull();
        });
    });
});

describe('computeEma20Slope', () => {
    describe('정상 입력', () => {
        it('(last - prev) / prev 를 반환한다', () => {
            const ema = Array.from({ length: 21 }, (_, i) => 100 + i);
            expect(computeEma20Slope(ema, 20)).toBeCloseTo(0.2);
        });
    });
    describe('데이터 부족 시', () => {
        it('null을 반환한다', () => {
            expect(computeEma20Slope([100, 101], 20)).toBeNull();
        });
    });
    describe('prev가 0일 때', () => {
        it('null을 반환한다', () => {
            const ema = [0, ...Array(20).fill(1)];
            expect(computeEma20Slope(ema, 20)).toBeNull();
        });
    });
    describe('last가 null일 때', () => {
        it('null을 반환한다', () => {
            const ema: (number | null)[] = [...Array(20).fill(1), null];
            expect(computeEma20Slope(ema, 20)).toBeNull();
        });
    });
    describe('prev가 null일 때', () => {
        it('null을 반환한다', () => {
            const ema: (number | null)[] = [null, ...Array(20).fill(1)];
            expect(computeEma20Slope(ema, 20)).toBeNull();
        });
    });
});

describe('percentileRank', () => {
    it('값이 배열 내에서 차지하는 백분위를 [0,1] 로 반환한다', () => {
        const xs = [1, 2, 3, 4, 5];
        expect(percentileRank(1, xs)).toBeCloseTo(0.0);
        expect(percentileRank(5, xs)).toBeCloseTo(1.0);
        expect(percentileRank(3, xs)).toBeCloseTo(0.5);
    });
    it('배열이 비어 있으면 null을 반환한다', () => {
        expect(percentileRank(1, [])).toBeNull();
    });
    describe('단일 원소 배열', () => {
        it('동일 값이면 0.5를 반환한다', () => {
            expect(percentileRank(5, [5])).toBeCloseTo(0.5);
        });
        it('값이 더 크면 1을 반환한다', () => {
            expect(percentileRank(10, [5])).toBe(1);
        });
        it('값이 더 작으면 0을 반환한다', () => {
            expect(percentileRank(1, [5])).toBe(0);
        });
    });
    describe('배열에 없는 값', () => {
        it('배열 내 상대 위치에 해당하는 비율을 반환한다', () => {
            expect(percentileRank(2.5, [1, 2, 3, 4, 5])).toBeCloseTo(0.4);
        });
    });
});
