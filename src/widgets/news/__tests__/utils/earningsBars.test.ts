import {
    getBarStyle,
    getBarWidth,
    getMaxAbs,
} from '@/widgets/news/utils/earningsBars';

describe('getMaxAbs', () => {
    it('null을 건너뛰고 절댓값의 최댓값을 돌려준다', () => {
        expect(getMaxAbs([1, -4, null, 2])).toBe(4);
    });

    it('값이 없으면 0이다', () => {
        expect(getMaxAbs([null, null])).toBe(0);
        expect(getMaxAbs([])).toBe(0);
    });
});

describe('getBarWidth', () => {
    it('[N8] 정확히 0은 폭 0이다 — 최소 폭이 0 실적을 양의 막대로 보이게 하지 않는다', () => {
        expect(getBarWidth(0, 10, false)).toBe(0);
        expect(getBarWidth(0, 10, true)).toBe(0);
    });

    it('0이 아닌 작은 값은 최소 6%를 보장한다', () => {
        expect(getBarWidth(0.01, 100, false)).toBe(6);
    });

    it('null이거나 기준 최댓값이 0이면 0이다', () => {
        expect(getBarWidth(null, 10, false)).toBe(0);
        expect(getBarWidth(5, 0, false)).toBe(0);
    });

    it('부호 있는 지표는 최대 50%, 아니면 100%까지 비례한다', () => {
        expect(getBarWidth(10, 10, true)).toBe(50);
        expect(getBarWidth(-5, 10, true)).toBe(25);
        expect(getBarWidth(10, 10, false)).toBe(100);
    });
});

describe('getBarStyle', () => {
    it('부호 없는 지표는 왼쪽에서 시작한다', () => {
        expect(getBarStyle(3, 40, false)).toEqual({ left: 0, width: '40%' });
    });

    it('부호 있는 지표는 음수가 중앙선 왼쪽, 양수가 오른쪽이다', () => {
        expect(getBarStyle(-3, 20, true)).toEqual({
            right: '50%',
            width: '20%',
        });
        expect(getBarStyle(3, 20, true)).toEqual({ left: '50%', width: '20%' });
    });
});
