import { toFiniteNumber } from '../toFiniteNumber';

describe('toFiniteNumber', () => {
    it('유한 숫자를 그대로 반환한다', () => {
        expect(toFiniteNumber(42)).toBe(42);
        expect(toFiniteNumber(0)).toBe(0);
        expect(toFiniteNumber(-3.14)).toBe(-3.14);
    });

    it('null 입력은 null을 반환한다', () => {
        expect(toFiniteNumber(null)).toBeNull();
    });

    it('undefined 입력은 null을 반환한다', () => {
        expect(toFiniteNumber(undefined)).toBeNull();
    });

    it('NaN은 null을 반환한다', () => {
        expect(toFiniteNumber(NaN)).toBeNull();
    });

    it('Infinity는 null을 반환한다', () => {
        expect(toFiniteNumber(Infinity)).toBeNull();
        expect(toFiniteNumber(-Infinity)).toBeNull();
    });
});
