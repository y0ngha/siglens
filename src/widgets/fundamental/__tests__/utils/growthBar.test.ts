import {
    GROWTH_TEXT_CLASS,
    growthBarView,
    growthTextClass,
} from '@/widgets/fundamental/utils/growthBar';

describe('growthBarView', () => {
    it('값이 없으면 막대를 그리지 않는다', () => {
        expect(growthBarView(null)).toEqual({
            formatted: '-',
            hasValue: false,
            isPositive: true,
            fillAbs: 0,
        });
    });

    it('양수·음수 방향과 폭을 계산한다', () => {
        expect(growthBarView(0.25)).toMatchObject({
            hasValue: true,
            isPositive: true,
            fillAbs: 25,
        });
        expect(growthBarView(-0.4)).toMatchObject({
            isPositive: false,
            fillAbs: 40,
        });
    });

    it('±100%에서 폭을 자른다', () => {
        expect(growthBarView(3).fillAbs).toBe(100);
        expect(growthBarView(-3).fillAbs).toBe(100);
    });

    it('0은 값이 있는 양수 취급이다', () => {
        expect(growthBarView(0)).toMatchObject({
            hasValue: true,
            isPositive: true,
        });
    });
});

describe('growthTextClass', () => {
    it('값 없음·양수·음수에 맞는 색을 고른다', () => {
        expect(growthTextClass(growthBarView(null))).toBe(
            GROWTH_TEXT_CLASS.none
        );
        expect(growthTextClass(growthBarView(0.1))).toBe(
            GROWTH_TEXT_CLASS.positive
        );
        expect(growthTextClass(growthBarView(-0.1))).toBe(
            GROWTH_TEXT_CLASS.negative
        );
    });
});
