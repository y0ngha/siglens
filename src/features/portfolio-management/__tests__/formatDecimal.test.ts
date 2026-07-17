import { trimTrailingZeros } from '../lib/formatDecimal';

describe('trimTrailingZeros', () => {
    it('passes through an integer string with no dot unchanged', () => {
        expect(trimTrailingZeros('10')).toBe('10');
    });

    it('trims trailing fractional zeros while keeping the significant digits', () => {
        expect(trimTrailingZeros('152.35000000')).toBe('152.35');
    });

    it('strips a dangling decimal point when all fractional digits are zero', () => {
        expect(trimTrailingZeros('100.00000000')).toBe('100');
    });

    it('keeps significant trailing zeros that are part of the value', () => {
        expect(trimTrailingZeros('0.00012345')).toBe('0.00012345');
    });

    it('leaves a value with no trailing zeros unchanged', () => {
        expect(trimTrailingZeros('10.5')).toBe('10.5');
    });

    it('trims a single trailing zero', () => {
        expect(trimTrailingZeros('10.50')).toBe('10.5');
    });
});
