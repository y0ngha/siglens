import {
    GRADE_BAND_KEYS,
    hasGrades,
    totalGrades,
} from '@/widgets/fundamental/utils/gradeBands';

const ZERO = { strongBuy: 0, buy: 0, hold: 0, sell: 0, strongSell: 0 };

describe('gradeBands', () => {
    it('밴드는 강한 매수에서 강한 매도 순서다', () => {
        expect(GRADE_BAND_KEYS).toEqual([
            'strongBuy',
            'buy',
            'hold',
            'sell',
            'strongSell',
        ]);
    });

    it('totalGrades는 다섯 밴드를 모두 더한다', () => {
        expect(
            totalGrades({
                strongBuy: 1,
                buy: 2,
                hold: 3,
                sell: 4,
                strongSell: 5,
            })
        ).toBe(15);
    });

    it('hasGrades는 null과 전부 0인 분포를 없는 것으로 본다', () => {
        expect(hasGrades(null)).toBe(false);
        expect(hasGrades(ZERO)).toBe(false);
    });

    it('hasGrades는 한 건이라도 있으면 참이다', () => {
        expect(hasGrades({ ...ZERO, strongSell: 1 })).toBe(true);
    });
});
