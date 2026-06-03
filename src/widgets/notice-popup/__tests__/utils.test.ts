import { formatNoticeDate } from '@/widgets/notice-popup/utils/formatNoticeDate';
import { toSafeHttpUrl } from '@/widgets/notice-popup/utils/toSafeHttpUrl';

describe('formatNoticeDate', () => {
    it('Date 객체 입력을 YYYY.MM.DD 작성 형태로 포맷한다', () => {
        expect(formatNoticeDate(new Date(2026, 5, 3))).toBe('2026.06.03 작성');
    });

    it('ISO 문자열 입력도 YYYY.MM.DD 작성 형태로 포맷한다', () => {
        expect(formatNoticeDate('2026-06-03T00:00:00')).toBe('2026.06.03 작성');
    });

    it('파싱할 수 없는 문자열은 빈 문자열을 반환한다', () => {
        expect(formatNoticeDate('not-a-date')).toBe('');
    });

    it('월·일이 한 자리일 때 0을 앞에 붙인다', () => {
        expect(formatNoticeDate(new Date(2026, 0, 5))).toBe('2026.01.05 작성');
    });
});

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
