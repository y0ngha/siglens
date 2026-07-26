import { buildTitleSubject } from '@/shared/lib/seo';

describe('buildTitleSubject', () => {
    it('한국어명이 있으면 한국어명(티커) 형태로 만든다', () => {
        expect(buildTitleSubject('AAPL', '애플')).toBe('애플(AAPL)');
    });

    it('한국어명이 없으면 티커만 반환한다', () => {
        expect(buildTitleSubject('AAPL')).toBe('AAPL');
    });

    it('빈 문자열 한국어명은 없는 것으로 취급한다', () => {
        expect(buildTitleSubject('AAPL', '')).toBe('AAPL');
    });

    it('공백뿐인 한국어명도 없는 것으로 취급한다', () => {
        expect(buildTitleSubject('AAPL', '   ')).toBe('AAPL');
    });

    it('한국어명이 티커와 같으면 중복을 피해 티커만 반환한다', () => {
        expect(buildTitleSubject('SOXL', 'SOXL')).toBe('SOXL');
    });

    it('티커를 대문자로 정규화한다', () => {
        expect(buildTitleSubject('aapl', '애플')).toBe('애플(AAPL)');
    });
});
