import { seoTitleWidth } from '@/shared/lib/seo';

describe('seoTitleWidth', () => {
    it('라틴 문자는 1단위로 센다', () => {
        expect(seoTitleWidth('AAPL')).toBe(4);
    });

    it('한글은 2단위로 센다', () => {
        expect(seoTitleWidth('애플')).toBe(4);
    });

    it('혼합 문자열을 가중 합산한다', () => {
        expect(seoTitleWidth('애플(AAPL)')).toBe(10);
    });

    it('공백과 기호는 1단위다', () => {
        expect(seoTitleWidth(' — ')).toBe(3);
    });

    it('빈 문자열은 0이다', () => {
        expect(seoTitleWidth('')).toBe(0);
    });

    it('서로게이트 페어를 한 글자로 센다', () => {
        expect(seoTitleWidth('😀')).toBe(2);
    });
});
