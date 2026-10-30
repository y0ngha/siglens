import { readConsentToken } from '../readConsentToken';

describe('readConsentToken', () => {
    it('문자열 토큰을 그대로 돌려준다', () => {
        expect(readConsentToken('abc123')).toBe('abc123');
    });

    it('쿼리가 없으면 null', () => {
        expect(readConsentToken(undefined)).toBeNull();
    });

    it('빈 토큰은 null', () => {
        expect(readConsentToken('')).toBeNull();
    });

    it('반복된 키(배열)는 null', () => {
        expect(readConsentToken(['abc123', 'x'])).toBeNull();
    });
});
