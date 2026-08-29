import {
    resolveNewsBody,
    resolveNewsSummary,
    resolveNewsTitle,
} from '@/shared/lib/news/resolveNewsTitle';

describe('resolveNewsTitle', () => {
    it('ko 로케일에서는 titleKo를 우선한다', () => {
        expect(
            resolveNewsTitle(
                { titleKo: '한국어 제목', titleEn: 'English title' },
                'ko'
            )
        ).toBe('한국어 제목');
    });

    it('ko 로케일에서 titleKo가 null이면 titleEn으로 폴백한다', () => {
        expect(
            resolveNewsTitle({ titleKo: null, titleEn: 'English title' }, 'ko')
        ).toBe('English title');
    });

    // 회귀 가드: 예전에는 로케일과 무관하게 titleKo ?? titleEn이라 en/ja/zh
    // 화면에도 한국어 헤드라인이 떴다.
    it('en 로케일에서는 titleEn을 우선한다', () => {
        expect(
            resolveNewsTitle(
                { titleKo: '한국어 제목', titleEn: 'English title' },
                'en'
            )
        ).toBe('English title');
    });

    it('ja 로케일에서는 titleEn을 우선한다', () => {
        expect(
            resolveNewsTitle(
                { titleKo: '한국어 제목', titleEn: 'English title' },
                'ja'
            )
        ).toBe('English title');
    });

    it('zh 로케일에서는 titleEn을 우선한다', () => {
        expect(
            resolveNewsTitle(
                { titleKo: '한국어 제목', titleEn: 'English title' },
                'zh'
            )
        ).toBe('English title');
    });

    it('en 로케일에서 titleEn이 빈 문자열이면 titleKo로 폴백한다', () => {
        expect(
            resolveNewsTitle({ titleKo: '한국어 제목', titleEn: '' }, 'en')
        ).toBe('한국어 제목');
    });

    it('en 로케일에서 titleEn이 빈 문자열이고 titleKo도 null이면 빈 문자열을 반환한다', () => {
        expect(resolveNewsTitle({ titleKo: null, titleEn: '' }, 'en')).toBe('');
    });

    it('degrade된 titleEn(null/undefined)에도 throw하지 않고 titleKo로 폴백한다', () => {
        expect(
            resolveNewsTitle(
                {
                    titleKo: '한국어 제목',
                    titleEn: null as unknown as string,
                },
                'en'
            )
        ).toBe('한국어 제목');
    });
});

/**
 * 서버가 사이드카에서 해석한 값은 **최우선**이다. ja/zh는 원본 컬럼
 * (`title_ko`/`title_en`)에 담길 자리가 아예 없어서, 이 우선순위가 없으면
 * 일본어 번역이 있어도 화면에 못 나온다.
 */
describe('titleLocalized 우선순위', () => {
    it('해석값이 있으면 로케일과 무관하게 그것을 쓴다', () => {
        expect(
            resolveNewsTitle(
                {
                    titleKo: '한국어',
                    titleEn: 'English',
                    titleLocalized: '日本語',
                },
                'ja'
            )
        ).toBe('日本語');
    });

    it('해석값이 없으면 기존 ko/en 규칙으로 내려간다', () => {
        expect(
            resolveNewsTitle({ titleKo: '한국어', titleEn: 'English' }, 'ja')
        ).toBe('English');
    });
});

describe('resolveNewsSummary / resolveNewsBody', () => {
    /** 요약·본문은 영어 원문 컬럼이 없다 — 번역이 없으면 한국어가 그대로 나간다. */
    it('해석값이 없으면 한국어 컬럼을 그대로 쓴다', () => {
        const item = { summaryKo: '요약', bodyKo: '본문' };
        expect(resolveNewsSummary(item)).toBe('요약');
        expect(resolveNewsBody(item)).toBe('본문');
    });

    it('해석값이 있으면 그것을 쓴다', () => {
        const item = {
            summaryKo: '요약',
            bodyKo: '본문',
            summaryLocalized: 'Summary',
            bodyLocalized: 'Body',
        };
        expect(resolveNewsSummary(item)).toBe('Summary');
        expect(resolveNewsBody(item)).toBe('Body');
    });

    it('둘 다 없으면 null', () => {
        expect(
            resolveNewsSummary({ summaryKo: null, bodyKo: null })
        ).toBeNull();
    });
});
