import { toSafeHttpUrl } from '@/shared/lib/safeUrl';

describe('toSafeHttpUrl', () => {
    it('https:// URL을 그대로 반환한다', () => {
        expect(toSafeHttpUrl('https://siglens.io/blog')).toBe(
            'https://siglens.io/blog'
        );
    });

    it('http:// URL을 그대로 반환한다', () => {
        expect(toSafeHttpUrl('http://example.com')).toBe('http://example.com');
    });

    it('javascript: 스킴은 null을 반환한다', () => {
        expect(toSafeHttpUrl('javascript:alert(1)')).toBeNull();
    });

    it('data: 스킴은 null을 반환한다', () => {
        expect(toSafeHttpUrl('data:text/html,<h1>xss</h1>')).toBeNull();
    });

    it('null 입력은 null을 반환한다', () => {
        expect(toSafeHttpUrl(null)).toBeNull();
    });

    it('빈 문자열은 null을 반환한다', () => {
        expect(toSafeHttpUrl('')).toBeNull();
    });

    it('대소문자 혼합 HTTPS:// 도 허용한다', () => {
        expect(toSafeHttpUrl('HTTPS://example.com')).toBe(
            'HTTPS://example.com'
        );
    });
});
