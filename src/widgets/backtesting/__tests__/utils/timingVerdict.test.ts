import { timingVerdict } from '../../utils/timingVerdict';

describe('timingVerdict', () => {
    it('is higher when the lower bound is above 0', () => {
        expect(timingVerdict({ low: 0.0001, high: 0.5 })).toBe('higher');
    });

    it('is lower when the upper bound is below 0', () => {
        expect(timingVerdict({ low: -0.5, high: -0.0001 })).toBe('lower');
    });

    it('is none when the range straddles 0', () => {
        expect(timingVerdict({ low: -0.4009, high: 0.3021 })).toBe('none');
    });

    it('is none when a bound sits exactly on 0', () => {
        expect(timingVerdict({ low: 0, high: 0.5 })).toBe('none');
        expect(timingVerdict({ low: -0.5, high: 0 })).toBe('none');
    });
});
