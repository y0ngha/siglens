import {
    percentText,
    returnColorClass,
    returnText,
    shareText,
} from '../../utils/percentText';

describe('percentText', () => {
    it('keeps one decimal and the minus sign', () => {
        expect(percentText(62.495)).toBe('62.5%');
        expect(percentText(-12.3901)).toBe('-12.4%');
    });
});

describe('shareText', () => {
    it('turns a 0..1 share into a percent', () => {
        expect(shareText(0.509)).toBe('50.9%');
        expect(shareText(0.006)).toBe('0.6%');
        expect(shareText(0)).toBe('0.0%');
        expect(shareText(1)).toBe('100.0%');
    });
});

describe('returnText', () => {
    it('signs the value after rounding', () => {
        expect(returnText(44.2921)).toBe('+44.3%');
        expect(returnText(-0.0602, 2)).toBe('-0.06%');
        expect(returnText(-0.001)).toBe('+0.0%');
    });
});

describe('returnColorClass', () => {
    const SUCCESS = 'text-ui-success-text';
    const DANGER = 'text-ui-danger-text';
    const NEUTRAL = 'text-secondary-300';

    it('is success for a positive value', () => {
        expect(returnColorClass(12.34)).toBe(SUCCESS);
        expect(returnColorClass(0.05)).toBe(SUCCESS);
    });

    it('is danger for a value that prints as negative', () => {
        expect(returnColorClass(-0.06)).toBe(DANGER);
        expect(returnColorClass(-12.34)).toBe(DANGER);
    });

    it('is neutral for a negative value that prints as +0.0%', () => {
        expect(returnText(-0.04)).toBe('+0.0%');
        expect(returnColorClass(-0.04)).toBe(NEUTRAL);
    });

    it('is neutral for a positive value that prints as +0.0%', () => {
        expect(returnText(0.04)).toBe('+0.0%');
        expect(returnColorClass(0.04)).toBe(NEUTRAL);
    });

    it('uses the printed precision to decide', () => {
        expect(returnText(-0.004, 2)).toBe('+0.00%');
        expect(returnColorClass(-0.004, 2)).toBe(NEUTRAL);
        expect(returnColorClass(-0.006, 2)).toBe(DANGER);
        expect(returnColorClass(-0.04, 2)).toBe(DANGER);
    });

    it('is neutral for exactly 0', () => {
        expect(returnColorClass(0)).toBe(NEUTRAL);
    });
});
