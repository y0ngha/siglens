import {
    isMissingTableError,
    isUniqueViolationError,
} from '@/entities/mail-alert/lib/dbErrorKind';

describe('dbErrorKind', () => {
    it('드리즐이 감싼 에러는 cause.code로, 감싸지 않은 에러는 code로 읽는다', () => {
        expect(isMissingTableError({ cause: { code: '42P01' } })).toBe(true);
        expect(isMissingTableError({ code: '42P01' })).toBe(true);
        expect(isUniqueViolationError({ cause: { code: '23505' } })).toBe(true);
        expect(isUniqueViolationError({ code: '23505' })).toBe(true);
    });

    it('다른 코드와 코드 없는 값은 둘 다 아니다', () => {
        expect(isMissingTableError({ code: '23505' })).toBe(false);
        expect(isUniqueViolationError({ code: '42P01' })).toBe(false);
        expect(isMissingTableError(new Error('x'))).toBe(false);
        expect(isUniqueViolationError(null)).toBe(false);
    });
});
