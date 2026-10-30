import {
    formatSignedFixed,
    roundToPrecision,
} from '@/widgets/economy/utils/signedFixed';

describe('roundToPrecision', () => {
    it('표시 자릿수로 반올림하고 -0은 0으로 접는다', () => {
        expect(roundToPrecision(-0.004, 2)).toBe(0);
        expect(Object.is(roundToPrecision(-0.004, 2), -0)).toBe(false);
        expect(roundToPrecision(0.126, 2)).toBe(0.13);
    });
});

describe('formatSignedFixed', () => {
    it.each([
        [-0.004, '0.00'],
        [0.003, '0.00'],
        [0.4, '+0.40'],
        [-0.25, '-0.25'],
    ])('%d → %s', (value, expected) => {
        expect(formatSignedFixed(value, 2, 'en')).toBe(expected);
    });
});
