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

// isFullWidthCodePoint는 module-private이라 seoTitleWidth를 통해 간접
// 검증한다. 각 구간의 첫/마지막 코드포인트가 실제로 2단위로 잡히는지
// String.fromCodePoint로 확인 — 이전에는 9개 구간 중 3개(한글 음절,
// 라틴, 이모지 앞쪽 구간)만 테스트가 있었다.
describe('isFullWidthCodePoint 경계값 (seoTitleWidth로 간접 검증)', () => {
    it('한글 자모 구간(U+1100~U+115F) 양끝은 2단위다', () => {
        expect(seoTitleWidth(String.fromCodePoint(0x1100))).toBe(2);
        expect(seoTitleWidth(String.fromCodePoint(0x115f))).toBe(2);
    });

    it('CJK 통합 표의문자 등 구간(U+2E80~U+A4CF) 양끝은 2단위다', () => {
        expect(seoTitleWidth(String.fromCodePoint(0x2e80))).toBe(2);
        expect(seoTitleWidth(String.fromCodePoint(0xa4cf))).toBe(2);
    });

    it('CJK 호환 한자 구간(U+F900~U+FAFF) 양끝은 2단위다', () => {
        expect(seoTitleWidth(String.fromCodePoint(0xf900))).toBe(2);
        expect(seoTitleWidth(String.fromCodePoint(0xfaff))).toBe(2);
    });

    it('CJK 호환 기호 구간(U+FE30~U+FE6F) 양끝은 2단위다', () => {
        expect(seoTitleWidth(String.fromCodePoint(0xfe30))).toBe(2);
        expect(seoTitleWidth(String.fromCodePoint(0xfe6f))).toBe(2);
    });

    it('전각 형태 구간(U+FF00~U+FF60) 양끝은 2단위다', () => {
        expect(seoTitleWidth(String.fromCodePoint(0xff00))).toBe(2);
        expect(seoTitleWidth(String.fromCodePoint(0xff60))).toBe(2);
    });

    it('전각 형태 보조 구간(U+FFE0~U+FFE6) 양끝은 2단위다', () => {
        expect(seoTitleWidth(String.fromCodePoint(0xffe0))).toBe(2);
        expect(seoTitleWidth(String.fromCodePoint(0xffe6))).toBe(2);
    });

    it('이모지 Supplemental Symbols and Pictographs 구간(U+1F900~U+1F9FF) 양끝은 2단위다', () => {
        expect(seoTitleWidth(String.fromCodePoint(0x1f900))).toBe(2);
        expect(seoTitleWidth(String.fromCodePoint(0x1f9ff))).toBe(2);
    });

    it('커버되지 않는 이모지 블록은 1단위다 — 🚀(U+1F680)·⭐(U+2B50)·✅(U+2705)', () => {
        expect(seoTitleWidth('🚀')).toBe(1);
        expect(seoTitleWidth('⭐')).toBe(1);
        expect(seoTitleWidth('✅')).toBe(1);
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
        // 어절 중간에서 잘리지 않는다 — 말줄임표를 뗀 본문이 원문의 접두사이고,
        // 원문에서 그 바로 다음 문자가 공백(=어절 경계)이어야 한다.
        // 이전 단언(`/\S…$/`)은 이 성질이 아니라 "말줄임표 앞 공백"이라는
        // 별개의 타이포그래피 규칙을 강제했다.
        const body = clamped.slice(0, -1);
        expect(long.startsWith(body)).toBe(true);
        expect(long[body.length]).toBe(' ');
        // 폭 상한만으로는 "첫 공백에서 자르기" 같은 오답 구현도 통과한다.
        // 실측한 리터럴로 고정해 falsifiable하게 만든다.
        expect(clamped).toBe(
            'ASE 테크놀로지 홀딩스(ASX) 옵션 분석 — Max Pain · OI…'
        );
    });

    it('공백이 없는 초장문도 상한을 넘기지 않는다', () => {
        const noSpace = '가'.repeat(100);
        const clamped = clampSeoTitle(noSpace);
        expect(seoTitleWidth(clamped)).toBeLessThanOrEqual(SEO_TITLE_MAX_WIDTH);
        expect(clamped).toBe('가'.repeat(27) + '…');
    });

    it('서로게이트 페어를 쪼개지 않는다', () => {
        const emoji = '😀'.repeat(40);
        const clamped = clampSeoTitle(emoji);
        expect([...clamped].every(c => c === '😀' || c === '…')).toBe(true);
        expect(clamped).toBe('😀'.repeat(27) + '…');
    });

    it('공백을 포함한 서로게이트 페어 혼합 입력에서 어절 경계 슬라이스가 UTF-16 인덱스를 쪼개지 않는다', () => {
        // 이모지만 있는 입력은 공백이 없어 head.slice(0, lastSpace) 분기(유일한
        // UTF-16 인덱스 슬라이스)를 타지 않는다. 공백을 하나 심어 그 분기를
        // 실제로 통과시킨다.
        const mixed = '😀'.repeat(20) + ' ' + '😀'.repeat(20);
        const clamped = clampSeoTitle(mixed);
        expect(clamped).toBe('😀'.repeat(20) + '…');
        expect([...clamped].every(c => c === '😀' || c === '…')).toBe(true);
    });

    it('상한과 정확히 같은 폭이면 그대로 통과한다 (경계값)', () => {
        const exact = 'A'.repeat(55);
        expect(seoTitleWidth(exact)).toBe(55);
        expect(clampSeoTitle(exact)).toBe(exact);
    });

    it('상한보다 1 폭단위 넘으면 클램프된다 (경계값)', () => {
        const overByOne = 'A'.repeat(56);
        expect(seoTitleWidth(overByOne)).toBe(56);
        expect(clampSeoTitle(overByOne)).toBe('A'.repeat(54) + '…');
    });

    it('명시적 maxWidth 인자를 받아 기본값 대신 사용한다', () => {
        expect(clampSeoTitle('hello world foo', 10)).toBe('hello…');
    });

    it('maxWidth가 0이면 말줄임표조차 담을 자리가 없어 빈 문자열을 반환한다', () => {
        expect(clampSeoTitle('hello', 0)).toBe('');
    });

    it('maxWidth가 1이면 말줄임표 한 글자만 반환한다', () => {
        expect(clampSeoTitle('hello', 1)).toBe('…');
    });
});
