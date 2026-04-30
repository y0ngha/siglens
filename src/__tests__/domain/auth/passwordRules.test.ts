import {
    MIN_PASSWORD_LENGTH,
    hasLetter,
    hasMinLength,
    hasNumber,
} from '@/domain/auth/passwordRules';

describe('passwordRules', () => {
    describe('MIN_PASSWORD_LENGTH', () => {
        it('최소 비밀번호 길이는 8이다', () => {
            expect(MIN_PASSWORD_LENGTH).toBe(8);
        });
    });

    describe('hasMinLength', () => {
        it('최소 길이 미만이면 false', () => {
            expect(hasMinLength('1234567')).toBe(false);
        });
        it('최소 길이와 같으면 true', () => {
            expect(hasMinLength('12345678')).toBe(true);
        });
        it('최소 길이 초과면 true', () => {
            expect(hasMinLength('123456789')).toBe(true);
        });
        it('빈 문자열이면 false', () => {
            expect(hasMinLength('')).toBe(false);
        });
    });

    describe('hasLetter', () => {
        it('영문이 포함되어 있으면 true', () => {
            expect(hasLetter('abc12345')).toBe(true);
        });
        it('영문이 없으면 false', () => {
            expect(hasLetter('12345678')).toBe(false);
        });
        it('대문자도 영문으로 인식한다', () => {
            expect(hasLetter('ABC12345')).toBe(true);
        });
    });

    describe('hasNumber', () => {
        it('숫자가 포함되어 있으면 true', () => {
            expect(hasNumber('abc12345')).toBe(true);
        });
        it('숫자가 없으면 false', () => {
            expect(hasNumber('abcdefgh')).toBe(false);
        });
    });
});
