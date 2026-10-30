import {
    EXTREME_PERCENTILE_HIGH,
    EXTREME_PERCENTILE_LOW,
    isExtremePercentile,
} from '../../utils/percentile';

describe('isExtremePercentile', () => {
    it('하위 경계 10은 극단이다(포함)', () => {
        expect(isExtremePercentile(10)).toBe(true);
    });

    it('하위 경계 바로 위 11은 극단이 아니다', () => {
        expect(isExtremePercentile(11)).toBe(false);
    });

    it('상위 경계 바로 아래 89는 극단이 아니다', () => {
        expect(isExtremePercentile(89)).toBe(false);
    });

    it('상위 경계 90은 극단이다(포함)', () => {
        expect(isExtremePercentile(90)).toBe(true);
    });

    it('양 끝(0, 100)은 극단이다', () => {
        expect([isExtremePercentile(0), isExtremePercentile(100)]).toEqual([
            true,
            true,
        ]);
    });

    it('경계 상수는 대칭이다(10과 90)', () => {
        expect([EXTREME_PERCENTILE_LOW, EXTREME_PERCENTILE_HIGH]).toEqual([
            10, 90,
        ]);
    });
});
