import {
    seoTitleWidth,
    clampSeoTitle,
    SEO_TITLE_MAX_WIDTH,
} from '@/shared/lib/seo';

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

describe('clampSeoTitle', () => {
    it('상한 이하면 그대로 반환한다', () => {
        const short = '애플(AAPL) 주가 전망';
        expect(clampSeoTitle(short)).toBe(short);
    });

    it('상한은 55다', () => {
        expect(SEO_TITLE_MAX_WIDTH).toBe(55);
    });

    it('초과 시 어절 경계에서 자르고 말줄임표를 붙인다', () => {
        const long =
            'ASE 테크놀로지 홀딩스(ASX) 옵션 분석 — Max Pain · OI · Put/Call · ATM IV';
        const clamped = clampSeoTitle(long);
        expect(seoTitleWidth(clamped)).toBeLessThanOrEqual(SEO_TITLE_MAX_WIDTH);
        expect(clamped.endsWith('…')).toBe(true);
        expect(clamped).not.toMatch(/\S…$/);
    });

    it('공백이 없는 초장문도 상한을 넘기지 않는다', () => {
        const noSpace = '가'.repeat(100);
        const clamped = clampSeoTitle(noSpace);
        expect(seoTitleWidth(clamped)).toBeLessThanOrEqual(SEO_TITLE_MAX_WIDTH);
    });

    it('서로게이트 페어를 쪼개지 않는다', () => {
        const emoji = '😀'.repeat(40);
        const clamped = clampSeoTitle(emoji);
        expect([...clamped].every(c => c === '😀' || c === '…')).toBe(true);
    });
});
