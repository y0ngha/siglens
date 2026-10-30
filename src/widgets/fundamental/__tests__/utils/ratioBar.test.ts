import {
    formatRatioPercent,
    ratioFillPercent,
} from '@/widgets/fundamental/utils/ratioBar';

describe('ratioBar', () => {
    it('비율을 퍼센트로 표기하고 없으면 -이다', () => {
        expect(formatRatioPercent(0.1234)).toBe('12.3%');
        expect(formatRatioPercent(0)).toBe('0.0%');
        expect(formatRatioPercent(null)).toBe('-');
    });

    it('채움 폭을 0~100으로 자른다', () => {
        expect(ratioFillPercent(0.5)).toBe(50);
        expect(ratioFillPercent(1.7)).toBe(100);
        expect(ratioFillPercent(-0.2)).toBe(0);
        expect(ratioFillPercent(null)).toBe(0);
    });
});
