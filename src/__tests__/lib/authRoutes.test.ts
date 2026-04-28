import { sanitizeNextPath } from '@/lib/authRoutes';

describe('sanitizeNextPath', () => {
    it('null/undefined 입력은 / 로 정규화된다', () => {
        expect(sanitizeNextPath(null)).toBe('/');
        expect(sanitizeNextPath(undefined)).toBe('/');
        expect(sanitizeNextPath('')).toBe('/');
    });

    it('절대 URL은 / 로 정규화된다 (open-redirect 방어)', () => {
        expect(sanitizeNextPath('https://evil.com/path')).toBe('/');
        expect(sanitizeNextPath('javascript:alert(1)')).toBe('/');
    });

    it('// 또는 /\\ 로 시작하는 경로는 / 로 정규화된다', () => {
        expect(sanitizeNextPath('//evil.com')).toBe('/');
        expect(sanitizeNextPath('/\\evil.com')).toBe('/');
    });

    it('같은 origin path는 그대로 반환된다', () => {
        expect(sanitizeNextPath('/market')).toBe('/market');
        expect(sanitizeNextPath('/AAPL?range=1d')).toBe('/AAPL?range=1d');
    });
});
