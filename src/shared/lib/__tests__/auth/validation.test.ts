import {
    normalizeEmail,
    validateEmail,
    validatePassword,
} from '@/shared/lib/auth/validation';

describe('normalizeEmail', () => {
    it('trims leading and trailing whitespace', () => {
        expect(normalizeEmail('  user@example.com  ')).toBe('user@example.com');
    });

    it('converts to lowercase', () => {
        expect(normalizeEmail('User@Example.COM')).toBe('user@example.com');
    });

    it('trims and lowercases combined', () => {
        expect(normalizeEmail(' User@Example.COM ')).toBe('user@example.com');
    });
});

describe('validateEmail', () => {
    it('returns null for a valid email', () => {
        expect(validateEmail('user@example.com')).toBeNull();
    });

    it('returns an error for an email without @', () => {
        const result = validateEmail('notanemail');
        expect(result).toEqual({
            code: 'invalid_email',
            field: 'email',
            message: '올바른 이메일 형식이 아닙니다.',
        });
    });

    it('returns an error for an email without domain', () => {
        const result = validateEmail('user@');
        expect(result).not.toBeNull();
        expect(result?.code).toBe('invalid_email');
    });

    it('returns an error for an email without local part', () => {
        const result = validateEmail('@example.com');
        expect(result).not.toBeNull();
        expect(result?.code).toBe('invalid_email');
    });
});

describe('validatePassword', () => {
    it('returns null for a valid password with letters and numbers', () => {
        expect(validatePassword('Password1')).toBeNull();
    });

    it('returns an error for a password shorter than 8 characters', () => {
        const result = validatePassword('Ps1');
        expect(result).toEqual({
            code: 'weak_password',
            field: 'password',
            message: '비밀번호는 8자 이상이며 영문자와 숫자를 포함해야 합니다.',
        });
    });

    it('returns an error for a password with no letters', () => {
        const result = validatePassword('12345678');
        expect(result).not.toBeNull();
        expect(result?.code).toBe('weak_password');
    });

    it('returns an error for a password with no numbers', () => {
        const result = validatePassword('password');
        expect(result).not.toBeNull();
        expect(result?.code).toBe('weak_password');
    });
});
