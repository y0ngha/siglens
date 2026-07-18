import { stripNegativeSign } from '../stripNegativeSign';

describe('stripNegativeSign', () => {
    it('removes a leading minus sign', () => {
        expect(stripNegativeSign('-100')).toBe('100');
    });

    it('removes a minus sign typed anywhere in the string', () => {
        expect(stripNegativeSign('1-0-0')).toBe('100');
    });

    it('removes multiple minus signs', () => {
        expect(stripNegativeSign('--150.5')).toBe('150.5');
    });

    it('leaves the decimal point and digits untouched', () => {
        expect(stripNegativeSign('152.35')).toBe('152.35');
    });

    it('passes through a value with no minus sign unchanged', () => {
        expect(stripNegativeSign('10')).toBe('10');
    });

    it('passes through an empty string unchanged', () => {
        expect(stripNegativeSign('')).toBe('');
    });
});
