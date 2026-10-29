import {
    buildMethodologyBreadcrumbJsonLd,
    buildMethodologyJsonLd,
    METHODOLOGY_PAGE_URL,
} from '@/app/[locale]/methodology/_lib/methodologyJsonLd';

const t = (key: string) => key;

describe('methodology JSON-LD', () => {
    it('절대 URL은 로케일 접두사 없는 /methodology다', () => {
        expect(METHODOLOGY_PAGE_URL).toBe('https://siglens.io/methodology');
    });

    it('publisher는 홈 Organization의 @id를 가리킨다', () => {
        expect(buildMethodologyJsonLd(t, 'ko').publisher).toEqual({
            '@id': 'https://siglens.io#organization',
        });
    });

    it('author는 /about의 Person @id를 가리킨다', () => {
        expect(buildMethodologyJsonLd(t, 'ko').author).toEqual({
            '@id': 'https://siglens.io/about#person',
        });
    });

    it('dateModified는 METHODOLOGY_UPDATED_AT의 ISO 문자열이다', () => {
        expect(buildMethodologyJsonLd(t, 'ko').dateModified).toBe(
            '2026-10-04T15:00:00.000Z'
        );
    });

    it('WebPage 노드의 키 순서를 고정한다', () => {
        expect(Object.keys(buildMethodologyJsonLd(t, 'ko'))).toEqual([
            '@context',
            '@type',
            '@id',
            'name',
            'description',
            'url',
            'inLanguage',
            'isPartOf',
            'dateModified',
            'publisher',
            'author',
        ]);
    });

    it('브레드크럼 마지막 마디 이름은 methodology.title이다', () => {
        expect(
            buildMethodologyBreadcrumbJsonLd(t, 'ko').itemListElement
        ).toEqual([
            {
                '@type': 'ListItem',
                position: 1,
                name: '시그렌즈',
                item: 'https://siglens.io',
            },
            {
                '@type': 'ListItem',
                position: 2,
                name: 'methodology.title',
                item: 'https://siglens.io/methodology',
            },
        ]);
    });
});
