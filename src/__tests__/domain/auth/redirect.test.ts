import {
    DEFAULT_REDIRECT_PATH,
    sanitizeNextPath,
} from '@/domain/auth/redirect';

describe('sanitizeNextPath', () => {
    it('null/undefined 입력은 기본 경로로 정규화된다', () => {
        expect(sanitizeNextPath(null)).toBe(DEFAULT_REDIRECT_PATH);
        expect(sanitizeNextPath(undefined)).toBe(DEFAULT_REDIRECT_PATH);
        expect(sanitizeNextPath('')).toBe(DEFAULT_REDIRECT_PATH);
    });

    it('절대 URL은 기본 경로로 정규화된다', () => {
        expect(sanitizeNextPath('https://evil.com/path')).toBe(
            DEFAULT_REDIRECT_PATH
        );
        expect(sanitizeNextPath('javascript:alert(1)')).toBe(
            DEFAULT_REDIRECT_PATH
        );
    });

    it('프로토콜 상대 경로와 역슬래시 호스트 경로는 기본 경로로 정규화된다', () => {
        expect(sanitizeNextPath('//evil.com')).toBe(DEFAULT_REDIRECT_PATH);
        expect(sanitizeNextPath('/\\evil.com')).toBe(DEFAULT_REDIRECT_PATH);
    });

    it('같은 origin path는 그대로 반환된다', () => {
        expect(sanitizeNextPath('/market')).toBe('/market');
        expect(sanitizeNextPath('/AAPL?range=1d')).toBe('/AAPL?range=1d');
    });
});
